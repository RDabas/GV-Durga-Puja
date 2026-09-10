"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  CoinsIcon,
  CollectIcon,
  DotIcon,
  HomeIcon,
  SponsorsIcon,
  VendorsIcon,
} from "@/components/icons";
import { useActivityUnread } from "@/lib/activitySeen";
import { usePujaData } from "@/lib/store";

const items = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/collect", label: "Collect", icon: CollectIcon },
  { href: "/funds", label: "Funds", icon: CoinsIcon },
  { href: "/sponsors", label: "Sponsors", icon: SponsorsIcon },
  { href: "/vendors", label: "Vendors", icon: VendorsIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const { latestActivityAt } = usePujaData();
  const unread = useActivityUnread(latestActivityAt);

  return (
    <nav
      className="sticky bottom-0 flex shrink-0 justify-around border-t border-border bg-surface pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2"
      aria-label="Primary"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 ${
              active ? "text-brand" : "text-ink-faint"
            }`}
          >
            <Icon className="h-[21px] w-[21px]" />
            {href === "/activity" && unread && (
              <DotIcon className="absolute right-2.5 top-0.5 h-[7px] w-[7px] text-critical" />
            )}
            <span className="text-[0.63rem] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
