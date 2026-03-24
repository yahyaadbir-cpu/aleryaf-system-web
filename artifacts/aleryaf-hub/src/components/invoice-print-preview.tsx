import { ArrowRight, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type PrintInvoiceData } from "@/lib/print-invoice";
import { InvoicePrintDocument } from "@/components/invoice-print-document";

interface InvoicePrintPreviewProps {
  invoice: PrintInvoiceData | null;
  open: boolean;
  onClose: () => void;
  onBackToInvoices: () => void;
  printHref?: string;
}

export function InvoicePrintPreview({
  invoice,
  open,
  onClose,
  onBackToInvoices,
  printHref,
}: InvoicePrintPreviewProps) {
  if (!open || !invoice) {
    return null;
  }

  const handlePrint = () => {
    if (printHref) {
      const openedWindow = window.open(printHref, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        window.location.assign(printHref);
      }
      return;
    }

    window.print();
  };

  return (
    <div className="invoice-preview-overlay">
      <div className="invoice-preview-shell">
        <div className="invoice-preview-toolbar screen-only">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-white">معاينة طباعة الفاتورة</p>
            <p className="mt-1 text-xs text-slate-400">{invoice.invoiceNumber}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button variant="outline" onClick={onBackToInvoices} className="invoice-action-button invoice-action-button--subtle text-white">
              <ArrowRight className="ml-2 h-4 w-4" />
              العودة إلى الفواتير
            </Button>
            <Button onClick={handlePrint} className="invoice-preview-print-button invoice-action-button text-white">
              <Printer className="ml-2 h-4 w-4" />
              طباعة
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="self-end text-slate-300 hover:bg-white/10 hover:text-white sm:self-auto">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="invoice-print-stage">
          <div className="invoice-print-sheet">
            <InvoicePrintDocument invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}
