export const TON_IN_KG = 1000;

function toSafeNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function getSalePricePerKg(unitPricePerTon: number | string | null | undefined) {
  return toSafeNumber(unitPricePerTon) / TON_IN_KG;
}

export function getInvoiceLineTotals(line: {
  quantity: number | string | null | undefined;
  unitPrice: number | string | null | undefined;
  unitCost: number | string | null | undefined;
}) {
  const quantityKg = toSafeNumber(line.quantity);
  const salePricePerTon = toSafeNumber(line.unitPrice);
  const costPerKg = toSafeNumber(line.unitCost);
  const salePricePerKg = getSalePricePerKg(salePricePerTon);
  const revenue = quantityKg * salePricePerKg;
  const totalCost = quantityKg * costPerKg;

  return {
    quantityKg,
    salePricePerTon,
    salePricePerKg,
    costPerKg,
    revenue,
    totalCost,
    profit: revenue - totalCost,
  };
}

export function summarizeInvoiceLines<T extends {
  quantity: number | string | null | undefined;
  unitPrice: number | string | null | undefined;
  unitCost: number | string | null | undefined;
}>(lines: T[]) {
  let revenue = 0;
  let totalCost = 0;

  const normalizedLines = lines.map((line) => {
    const totals = getInvoiceLineTotals(line);
    revenue += totals.revenue;
    totalCost += totals.totalCost;
    return {
      ...line,
      ...totals,
    };
  });

  return {
    lines: normalizedLines,
    revenue,
    totalCost,
    profit: revenue - totalCost,
  };
}
