import { APP_NAME_AR } from "@/lib/branding";
import { preparePrintInvoice, type InvoicePrintLanguage, type PrintInvoiceData } from "@/lib/print-invoice";
import logoUrl from "@assets/aleryaf-logo-clean.png";

function formatCurrencyByLanguage(amount: number, currency: "TRY" | "USD", language: InvoicePrintLanguage) {
  return new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumberByLanguage(value: number, language: InvoicePrintLanguage) {
  return new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateByLanguage(value: string, language: InvoicePrintLanguage) {
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

const COPY = {
  ar: {
    dir: "rtl" as const,
    articleClass: "ipd ipd--print-doc",
    companyName: APP_NAME_AR,
    brandTag: "فاتورة مبيعات",
    title: "فاتورة",
    eyebrow: "ALERYAF TRADING COMPANY",
    customer: "العميل / الزبون",
    branch: "الفرع",
    currency: "العملة",
    invoiceNumber: "رقم الفاتورة",
    item: "الصنف",
    count: "عدد",
    quantity: "الكمية (كغ)",
    tonPrice: "سعر الطن",
    total: "الإجمالي",
    notes: "ملاحظات",
    grandTotal: "الإجمالي الكلي",
    totalQuantity: "إجمالي الكمية",
    thanks: "شكراً لتعاملكم معنا",
    empty: "لا توجد بنود في هذه الفاتورة",
  },
  tr: {
    dir: "ltr" as const,
    articleClass: "ipd ipd--print-doc ipd--ltr",
    companyName: "Aleryaf Ticaret Şirketi",
    brandTag: "Satış Faturası",
    title: "Fatura",
    eyebrow: "ALERYAF TRADING COMPANY",
    customer: "Müşteri",
    branch: "Şube",
    currency: "Para Birimi",
    invoiceNumber: "Fatura No",
    item: "Ürün",
    count: "Adet",
    quantity: "Miktar (kg)",
    tonPrice: "Ton Fiyatı",
    total: "Toplam",
    notes: "Notlar",
    grandTotal: "Genel Toplam",
    totalQuantity: "Toplam Miktar",
    thanks: "Teşekkür ederiz",
    empty: "Bu faturada kalem bulunmuyor",
  },
};

export function InvoicePrintDocument({
  invoice,
  language = "ar",
}: {
  invoice: PrintInvoiceData;
  language?: InvoicePrintLanguage;
}) {
  const prepared = preparePrintInvoice(invoice);
  const totalQuantityKg = prepared.lines.reduce((sum, item) => sum + item.quantityKg, 0);
  const copy = COPY[language];

  return (
    <article className={copy.articleClass} dir={copy.dir}>
      <header className="ipd__header">
        <div className="ipd__header-logo" aria-hidden="true">
          <img src={logoUrl} alt="Aleryaf logo" className="ipd__logo" />
        </div>

        <div className="ipd__brand">
          <div className="ipd__brand-name">{copy.companyName}</div>
          <div className="ipd__brand-tag">{copy.brandTag}</div>
        </div>

        <div className="ipd__invoice-meta">
          <div className="ipd__eyebrow">{copy.eyebrow}</div>
          <h1 className="ipd__title">{copy.title}</h1>
          <div className="ipd__meta-line">
            {copy.invoiceNumber}: {invoice.invoiceNumber}
          </div>
          <div className="ipd__meta-line">
            {language === "tr" ? "Tarih" : "التاريخ"}: {formatDateByLanguage(invoice.invoiceDate, language)}
          </div>
        </div>
      </header>

      <section className="ipd__info-grid">
        <div className="ipd__info-box">
          <div className="ipd__info-label">{copy.customer}</div>
          <div className="ipd__info-value">{invoice.customerName || "-"}</div>
        </div>
        <div className="ipd__info-box">
          <div className="ipd__info-label">{copy.branch}</div>
          <div className="ipd__info-value">{invoice.branchName || "-"}</div>
        </div>
        <div className="ipd__info-box">
          <div className="ipd__info-label">{copy.currency}</div>
          <div className="ipd__info-value">{prepared.currencyLabel}</div>
        </div>
        <div className="ipd__info-box">
          <div className="ipd__info-label">{copy.invoiceNumber}</div>
          <div className="ipd__info-value">{invoice.invoiceNumber}</div>
        </div>
      </section>

      <section className="ipd__table-wrap">
        <table className="ipd__table">
          <thead>
            <tr>
              <th style={{ width: "7%" }}>#</th>
              <th className="ipd__th-name" style={{ width: prepared.hasCountColumn ? "29%" : "39%" }}>
                {copy.item}
              </th>
              {prepared.hasCountColumn ? <th style={{ width: "12%" }}>{copy.count}</th> : null}
              <th style={{ width: "17%" }}>{copy.quantity}</th>
              <th style={{ width: "17%" }}>{copy.tonPrice}</th>
              <th style={{ width: "18%" }}>{copy.total}</th>
            </tr>
          </thead>
          <tbody>
            {prepared.lines.length ? (
              prepared.lines.map((item, index) => (
                <tr key={`${item.itemName || item.rawName || "line"}-${index}`}>
                  <td>{index + 1}</td>
                  <td className="ipd__item-name">{item.itemName || item.rawName || "-"}</td>
                  {prepared.hasCountColumn ? (
                    <td>{item.count == null || String(item.count).trim() === "" ? "-" : item.count}</td>
                  ) : null}
                  <td>{formatNumberByLanguage(item.quantityKg, language)}</td>
                  <td>{formatCurrencyByLanguage(item.salePricePerKg * 1000, prepared.currency, language)}</td>
                  <td className="ipd__amount">{formatCurrencyByLanguage(item.revenue, prepared.currency, language)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={prepared.hasCountColumn ? 6 : 5} className="ipd__empty">
                  {copy.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="ipd__totals-row">
        <div className="ipd__side-stack">
          {invoice.notes ? (
            <div className="ipd__notes">
              <div className="ipd__notes-label">{copy.notes}</div>
              <div className="ipd__notes-body">{invoice.notes}</div>
            </div>
          ) : (
            <div className="ipd__notes-spacer" aria-hidden="true" />
          )}
        </div>

        <div className="ipd__total-card">
          <div className="ipd__total-label">{copy.grandTotal}</div>
          <div className="ipd__total-value">{formatCurrencyByLanguage(prepared.revenue, prepared.currency, language)}</div>
          <div className="ipd__total-meta">
            <span>{copy.totalQuantity}</span>
            <strong>{formatNumberByLanguage(totalQuantityKg, language)} kg</strong>
          </div>
        </div>
      </section>

      <footer className="ipd__footer">{copy.thanks}</footer>
    </article>
  );
}
