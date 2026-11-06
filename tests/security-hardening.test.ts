import { describe, expect, test } from "vitest";
import { csvCell, toCSV, type ExpenseTxn } from "../src/engine/expense-engine";
import { parseFuelCsv } from "../src/engine/garage-engine";
import LE from "../src/engine/ledger-engine.js";
import { continuousDaily, dailyUsage, plausibleReadingTime, sortReadings } from "../src/engine/power-engine";

describe("CSV cells", () => {
  test("neutralizes values a spreadsheet would run as formulas", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\t=1", "\r=1"]) expect(csvCell(v)).toBe(`"'${v}"`);
  });

  test("leaves ordinary text alone and doubles quotes", () => {
    expect(csvCell("Shell, Lahore")).toBe('"Shell, Lahore"');
    expect(csvCell('A "b"')).toBe('"A ""b"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  test("expense export covers description and category", () => {
    const t: ExpenseTxn = { id: "a", txn_date: "2026-07-01", description: "=1+1", amount: 5, category: '@x"y', direction: "OUT", created_at: 1 };
    expect(toCSV([t]).split("\n")[1]).toBe(`2026-07-01,"'=1+1","'@x""y",OUT,5`);
  });

  test("fuel import undoes the prefix our export adds, and keeps other apostrophes", () => {
    const csv = (station: string) => `Date,Odometer (km),Litres,Cost (Rs),Full tank,Station\n2026-01-01,100,10,1000,yes,${station}`;
    expect(parseFuelCsv(csv(`"'=1+1"`)).rows[0].station).toBe("=1+1");
    expect(parseFuelCsv(csv("'t Hof")).rows[0].station).toBe("'t Hof");
  });
});

describe("asset logos", () => {
  const asset = (img: string) => LE.sanitizeAsset({ id: "crypto:X", type: "crypto", symbol: "X", name: "n", img })!.img;

  test("keeps CoinGecko https images", () => {
    expect(asset("https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png")).toBe("https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png");
    expect(asset("https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png")).toBe("https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png");
  });

  test("drops other hosts, plain http and look-alike URLs", () => {
    for (const u of ["https://evil.example/x.png", "http://assets.coingecko.com/x.png", "https://assets.coingecko.com.evil.example/x.png", "https://assets.coingecko.com@evil.example/x.png", "https://u:p@assets.coingecko.com/x.png"]) {
      expect(asset(u)).toBeNull();
    }
  });
});

describe("meter reading times", () => {
  const t2026 = Date.UTC(2026, 0, 1);
  const r = (id: string, v: number, t: number) => ({ id, v, t });

  test("only plausible years count", () => {
    expect(plausibleReadingTime(t2026)).toBe(true);
    for (const t of [0, -1, 1e15, 8e15, NaN, Infinity]) expect(plausibleReadingTime(t)).toBe(false);
  });

  test("an extreme timestamp can't blow up the per-day loops", () => {
    const readings = [r("a", 0, t2026), r("b", 10, t2026 + 2 * 86400000), r("c", 20, 1e15), r("d", 30, 0)];
    expect(sortReadings(readings).map((x) => x.id)).toEqual(["a", "b"]);
    expect(dailyUsage(readings).length).toBeLessThanOrEqual(3);
    expect(continuousDaily(readings).length).toBeLessThanOrEqual(3);
  });
});
