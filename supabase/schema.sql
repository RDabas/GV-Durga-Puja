-- GV Durga Puja committee app schema.
-- Run against a fresh Supabase project (SQL editor or `supabase db push`).

create extension if not exists "pgcrypto";

create type block_letter as enum ('A', 'B', 'C', 'D', 'E', 'F', 'G');
create type payment_mode as enum ('cash', 'gpay', 'phonepe', 'other_upi', 'pending');
create type contribution_status as enum ('paid', 'partial', 'promised', 'pending', 'not_visited', 'not_home');
create type contribution_kind as enum ('money', 'bhog_grocery', 'both');
create type sponsor_type as enum ('outside', 'stall', 'no_stall');
create type committee_role as enum ('admin', 'collector');
create type transfer_mode as enum ('cash', 'online');
create type carried_fund_kind as enum ('cash', 'fd', 'bank');

-- One row per Navratri event. Everything financial is scoped by year_id so
-- history from prior years is preserved for comparison.
create table puja_years (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  shashthi_date date not null,
  dashami_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  collection_goal numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- An owner may hold several flats and contributes once for all of them, so
-- owners are their own table rather than a name column on houses.
create table owners (
  id uuid primary key default gen_random_uuid(),
  names text[] not null,
  phone text,
  created_at timestamptz not null default now()
);

-- Static flat directory, numbered <floor><11-14> (111-114 ... 1111-1114).
-- Tenants live on the flat because they always pay per flat.
create table houses (
  id uuid primary key default gen_random_uuid(),
  block block_letter not null,
  floor int not null,
  flat_no text not null,
  owner_id uuid references owners(id) on delete set null,
  tenant_names text[] not null default '{}',
  tenant_phone text,
  created_at timestamptz not null default now(),
  unique (block, flat_no)
);

-- auth_user_id is nullable: an admin adds a member by name so they can be
-- picked as "collected by" straight away, and the row is linked to a real
-- login the first time that person signs in.
create table committee_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade unique,
  name text not null,
  phone text,
  role committee_role not null default 'collector',
  created_at timestamptz not null default now()
);

-- A flat yields at most two entries per year: one from its tenants (tied to
-- the flat) and one from its owner (tied to the owner, since an owner of
-- several flats hands over a single amount covering all of them). Exactly one
-- of house_id / owner_id is set.
create table contributions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references houses(id) on delete cascade,
  owner_id uuid references owners(id) on delete cascade,
  year_id uuid not null references puja_years(id) on delete cascade,
  collector_id uuid references committee_members(id),
  -- Who should go back for a "nobody home"/"not visited" flat — separate
  -- from collector_id, which only ever names who actually took the money.
  -- assigned_to_name covers someone not in committee_members (a family
  -- member, a guard); at most one of the two is set at a time.
  assigned_to_member_id uuid references committee_members(id),
  assigned_to_name text,
  money_amount numeric(10, 2) not null default 0,
  -- Set only when money_amount (while promised) was reduced from a larger
  -- original pledge, e.g. part of it settled by paying a vendor directly.
  original_pledge_amount numeric(10, 2),
  bhog_grocery_amount numeric(10, 2) not null default 0,
  contribution_kind contribution_kind not null default 'money',
  payment_mode payment_mode not null default 'pending',
  status contribution_status not null default 'not_visited',
  payment_date date,
  note text,
  follow_up_note text,
  updated_at timestamptz not null default now(),
  constraint contributions_one_payer check (
    (house_id is not null) <> (owner_id is not null)
  )
);
create unique index contributions_tenant_per_year on contributions(house_id, year_id)
  where house_id is not null;
create unique index contributions_owner_per_year on contributions(owner_id, year_id)
  where owner_id is not null;

-- Residents always pay a specific committee member (that member's own cash box
-- or personal UPI) — collector_id on contributions already captures who first
-- received it. This table is the ledger for what happens *after* that: members
-- handing over cash or transferring UPI to each other to consolidate funds.
-- A committee member's cash/UPI currently in hand for a year is:
--   sum(contributions.money_amount where collector_id = member)
--   + sum(fund_transfers.amount where to_member_id = member)
--   - sum(fund_transfers.amount where from_member_id = member)
create table fund_transfers (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references puja_years(id) on delete cascade,
  from_member_id uuid references committee_members(id),
  to_member_id uuid references committee_members(id),
  amount numeric(10, 2) not null check (amount > 0),
  mode transfer_mode not null default 'cash',
  transfer_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint fund_transfers_has_a_party check (from_member_id is not null or to_member_id is not null),
  constraint fund_transfers_distinct_parties check (from_member_id is distinct from to_member_id)
);

-- Money a member was still holding when a year opened — cash never handed
-- over, a bank FD, or an account balance from the previous year. Recorded
-- against the year it opens into, and added to that member's balance in hand
-- the same way fund_transfers.amount is.
create table carried_funds (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references puja_years(id) on delete cascade,
  member_id uuid not null references committee_members(id),
  kind carried_fund_kind not null default 'cash',
  amount numeric(10, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references puja_years(id) on delete cascade,
  name text not null,
  contact text,
  type sponsor_type not null default 'no_stall',
  stall_details text,
  amount_pledged numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Amount received from a sponsor is the sum of these rows, not a column on
-- sponsors — each instalment records which app or cash it arrived through,
-- and member_id records which committee member's hand it passed through, so
-- it adds to that member's balance in hand the same way a contribution does.
create table sponsor_payments (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  member_id uuid not null references committee_members(id),
  amount numeric(10, 2) not null,
  payment_date date not null default current_date,
  mode payment_mode not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

-- Static vendor directory across years.
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_type text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table vendor_expenses (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  year_id uuid not null references puja_years(id) on delete cascade,
  total_amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (vendor_id, year_id)
);

-- Zero rows = nothing paid yet; one row = paid in full; many rows = installments.
-- member_id records which committee member handed this over — it comes out
-- of their balance in hand, mirroring sponsor_payments.member_id.
create table vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_expense_id uuid not null references vendor_expenses(id) on delete cascade,
  member_id uuid not null references committee_members(id),
  amount numeric(10, 2) not null,
  payment_date date not null default current_date,
  mode payment_mode not null default 'cash',
  note text,
  -- Paid from member_id's own pocket (e.g. offsetting their own resident
  -- pledge) rather than committee cash, so it shouldn't reduce their balance
  -- in hand the way a normal vendor payment does.
  self_funded boolean not null default false,
  created_at timestamptz not null default now()
);

-- --- Row Level Security -----------------------------------------------------
-- Every table is restricted to authenticated committee members. Only admins
-- can write sponsor/vendor financials or edit another collector's entries;
-- collectors can read everything and write their own contribution rows.

alter table puja_years enable row level security;
alter table houses enable row level security;
alter table owners enable row level security;
alter table committee_members enable row level security;
alter table contributions enable row level security;
alter table fund_transfers enable row level security;
alter table carried_funds enable row level security;
alter table sponsors enable row level security;
alter table sponsor_payments enable row level security;
alter table vendors enable row level security;
alter table vendor_expenses enable row level security;
alter table vendor_payments enable row level security;

create function is_committee_member() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from committee_members where auth_user_id = auth.uid()
  );
$$;

create function is_committee_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from committee_members where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "committee can read everything: puja_years" on puja_years
  for select using (is_committee_member());
create policy "admins manage puja_years" on puja_years
  for all using (is_committee_admin()) with check (is_committee_admin());

-- Collectors correct tenant names at the door, so houses are member-writable
-- for updates while structural changes stay with admins.
create policy "committee can read everything: houses" on houses
  for select using (is_committee_member());
create policy "committee can update houses" on houses
  for update using (is_committee_member());
create policy "admins manage houses" on houses
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read owners" on owners
  for select using (is_committee_member());
create policy "committee can add owners" on owners
  for insert with check (is_committee_member());
create policy "committee can update owners" on owners
  for update using (is_committee_member());

create policy "committee can read committee_members" on committee_members
  for select using (is_committee_member());
create policy "admins manage committee_members" on committee_members
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read contributions" on contributions
  for select using (is_committee_member());
create policy "committee can add contributions" on contributions
  for insert with check (is_committee_member());
create policy "collectors update own contributions, admins update all" on contributions
  for update using (
    is_committee_admin()
    or collector_id = (select id from committee_members where auth_user_id = auth.uid())
  );

create policy "committee can read fund_transfers" on fund_transfers
  for select using (is_committee_member());
create policy "committee can log fund_transfers" on fund_transfers
  for insert with check (
    is_committee_admin()
    or (select id from committee_members where auth_user_id = auth.uid()) in (from_member_id, to_member_id)
  );
create policy "admins manage fund_transfers" on fund_transfers
  for update using (is_committee_admin());

create policy "committee can read carried_funds" on carried_funds
  for select using (is_committee_member());
create policy "admins manage carried_funds" on carried_funds
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read sponsors" on sponsors
  for select using (is_committee_member());
create policy "admins manage sponsors" on sponsors
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read sponsor_payments" on sponsor_payments
  for select using (is_committee_member());
create policy "admins manage sponsor_payments" on sponsor_payments
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read vendors" on vendors
  for select using (is_committee_member());
create policy "admins manage vendors" on vendors
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read vendor_expenses" on vendor_expenses
  for select using (is_committee_member());
create policy "admins manage vendor_expenses" on vendor_expenses
  for all using (is_committee_admin()) with check (is_committee_admin());

create policy "committee can read vendor_payments" on vendor_payments
  for select using (is_committee_member());
create policy "admins manage vendor_payments" on vendor_payments
  for all using (is_committee_admin()) with check (is_committee_admin());
