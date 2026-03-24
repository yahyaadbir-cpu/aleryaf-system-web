import { summarizeInvoiceLines } from "./invoice-math";

export interface PrintInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  branchName: string;
  currency: "TRY" | "USD";
  customerName?: string;
  notes?: string;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  items?: Array<{
    itemName?: string;
    rawName?: string;
    count?: number | string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    totalPrice: number;
    totalCost: number;
  }>;
}

function sanitizePrintFileName(value?: string | null) {
  const cleaned = (value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "");

  return cleaned || "invoice";
}

export function getInvoicePrintDocumentTitle(invoice: PrintInvoiceData) {
  const customerName = (invoice.customerName ?? "").trim();
  if (customerName) {
    return sanitizePrintFileName(`فاتورة الزبون ${customerName}`);
  }

  return sanitizePrintFileName(`فاتورة ${invoice.invoiceNumber}`);
}

export function preparePrintInvoice(invoice: PrintInvoiceData) {
  const currency = invoice.currency;
  const summary = summarizeInvoiceLines(invoice.items || []);
  const currencyLabel = currency === "USD" ? "USD" : "TRY";
  const hasCountColumn = summary.lines.some((item) => item.count != null && String(item.count).trim() !== "");

  return {
    currency,
    currencyLabel,
    hasCountColumn,
    lines: summary.lines,
    revenue: summary.revenue,
    totalCost: summary.totalCost,
    profit: summary.profit,
  };
}
