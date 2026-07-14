import { balanceForCharge, balanceStatus, buildPaymentsCsv, parseDollarsToCents } from "./payments";

describe("payment ledger helpers", () => {
  test("parses dollars without floating point rounding", () => {
    expect(parseDollarsToCents("$1,234.50")).toBe(123450);
    expect(parseDollarsToCents("75")).toBe(7500);
    expect(parseDollarsToCents("1.2")).toBe(120);
    expect(parseDollarsToCents("1.234")).toBeNull();
    expect(parseDollarsToCents("-5")).toBeNull();
  });

  test("derives partial, paid, and credit balances from entries", () => {
    const charge = { id: "c1", amount_due_cents: 10000 };
    expect(balanceForCharge(charge, [{ charge_id: "c1", amount_cents: 2500 }])).toBe(7500);
    expect(balanceStatus(7500, 2500)).toBe("partial");
    expect(balanceStatus(0, 10000)).toBe("paid");
    expect(balanceStatus(-500, 10500)).toBe("credit");
  });

  test("CSV exports charges without payments and neutralizes spreadsheet formulas", () => {
    const csv = buildPaymentsCsv({
      charges: [{ id: "c1", season: "Summer 2026", profile_id: "p1", team_id: null, kind: "other", amount_due_cents: 500, notes: "=HYPERLINK(\"bad\")" }],
      paymentEntries: [],
      ownerName: () => "+Player",
    });
    expect(csv).toContain("$5.00");
    expect(csv).toContain("'+Player");
    expect(csv).toContain("'=HYPERLINK");
  });
});
