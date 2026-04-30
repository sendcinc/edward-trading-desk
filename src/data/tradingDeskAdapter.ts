import { demoTradingDeskSnapshot } from "./demoSnapshot";
import type { TradingDeskSnapshot } from "../domain/tradingDesk";

export type TradingDeskSource = "demo" | "edward-api";

const EDWARD_SNAPSHOT_ENDPOINT = "/api/trading-desk/snapshot";

export async function loadTradingDeskSnapshot(source: TradingDeskSource = "demo"): Promise<TradingDeskSnapshot> {
  if (source === "demo") {
    return demoTradingDeskSnapshot;
  }

  const response = await fetch(EDWARD_SNAPSHOT_ENDPOINT, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Edward snapshot unavailable: ${response.status}`);
  }

  return (await response.json()) as TradingDeskSnapshot;
}
