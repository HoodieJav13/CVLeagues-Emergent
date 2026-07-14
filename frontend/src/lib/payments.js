export function parseDollarsToCents(value) {
  const normalized = String(value ?? "").trim().replaceAll(",", "").replace(/^\$/, "");
  const match = normalized.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(dollars) || dollars > Math.floor(Number.MAX_SAFE_INTEGER / 100)) return null;
  return dollars * 100 + cents;
}

export function formatCents(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
}

export function paidCentsForCharge(paymentEntries, chargeId) {
  return paymentEntries
    .filter((entry) => entry.charge_id === chargeId)
    .reduce((sum, entry) => sum + Number(entry.amount_cents || 0), 0);
}

export function balanceForCharge(charge, paymentEntries) {
  return Number(charge.amount_due_cents || 0) - paidCentsForCharge(paymentEntries, charge.id);
}

export function balanceStatus(balanceCents, paidCents) {
  if (balanceCents < 0) return "credit";
  if (balanceCents === 0) return "paid";
  if (paidCents > 0) return "partial";
  return "unpaid";
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildPaymentsCsv({ charges, paymentEntries, ownerName }) {
  const header = ["Season", "Owner Type", "Owner", "Charge Kind", "Amount Due", "Amount Paid", "Balance", "Status", "Charge Notes", "Payment Date", "Payment Amount", "Payment Method", "Payment Note"];
  const rows = [header];

  charges.forEach((charge) => {
    const entries = paymentEntries
      .filter((entry) => entry.charge_id === charge.id)
      .sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at)));
    const paid = paidCentsForCharge(entries, charge.id);
    const balance = Number(charge.amount_due_cents || 0) - paid;
    const common = [
      charge.season,
      charge.team_id ? "Team" : "Player",
      ownerName(charge),
      charge.kind,
      formatCents(charge.amount_due_cents),
      formatCents(paid),
      formatCents(balance),
      balanceStatus(balance, paid),
      charge.notes || "",
    ];
    if (!entries.length) rows.push([...common, "", "", "", ""]);
    entries.forEach((entry) => rows.push([
      ...common,
      entry.paid_at || "",
      formatCents(entry.amount_cents),
      entry.method || "",
      entry.note || "",
    ]));
  });

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
