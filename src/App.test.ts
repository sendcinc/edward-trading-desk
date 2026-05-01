import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(currentDir, "App.tsx"), "utf8");

describe("Trading Desk shell", () => {
  it("does not render the visible data source/demo control panel", () => {
    expect(appSource).not.toContain("<DemoControls");
    expect(appSource).not.toContain("Data source and demo scenario controls");
    expect(appSource).not.toContain("Live Edward snapshot first");
    expect(appSource).not.toContain("Demo remains available as an explicit fallback");
  });

  it("keeps journal cards above a full-field all-trades table", () => {
    expect(appSource.indexOf('className="trade-journal-stats"')).toBeGreaterThan(-1);
    expect(appSource.indexOf('className="trade-journal-table-wrap"')).toBeGreaterThan(
      appSource.indexOf('className="trade-journal-stats"'),
    );
    expect(appSource).toContain("journal.tableRows.map");
    for (const header of [
      "Trade ID",
      "Date",
      "Symbol",
      "Side",
      "Status",
      "Opened",
      "Closed",
      "Entry",
      "Exit",
      "Size",
      "P&amp;L",
      "Fees",
      "Funding",
      "Framework",
      "Reason",
    ]) {
      expect(appSource).toContain(`<th>${header}</th>`);
    }
    expect(appSource).not.toContain("<th>Confidence</th>");
    expect(appSource).not.toContain("row.confidence");
  });
});
