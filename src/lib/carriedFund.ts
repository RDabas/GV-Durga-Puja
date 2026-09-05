import type { CarriedFundKind } from "@/lib/types";

export const carriedFundKindLabels: Record<CarriedFundKind, string> = {
  cash: "Cash in hand",
  fd: "Bank FD",
  bank: "Bank account",
};
