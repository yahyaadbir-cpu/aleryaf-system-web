import { APP_NAME_AR, APP_NAME_EN } from "@/lib/branding";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { preparePrintInvoice, type PrintInvoiceData } from "@/lib/print-invoice";

export function InvoicePrintDocument({ invoice }: { invoice: PrintInvoiceData }) {
  const prepared = preparePrintInvoice(invoice);

  return (
    <article className="ipd" dir="rtl">
      <header className="ipd__header">
        <div className="ipd__brand">
          <div className="ipd__brand-ar">{APP_NAME_AR}</div>
          <div className="ipd__brand-en">{APP_NAME_EN}</div>
        </div>
        <div className="ipd__title-block">
          <div className="ipd__title-label">{APP_NAME_AR}</div>
          <div className="ipd__title">فاتورة</div>
          <div className="ipd__meta-line">رقم الفاتورة: {invoice.invoiceNumber}</div>
          <div className="ipd__meta-line">التاريخ: {formatDate(invoice.invoiceDate)}</div>
        </div>
      </header>

      <div className="ipd__divider" />

      <div className="ipd__info-grid">
        <div className="ipd__info-box">
          <span className="ipd__info-label">العميل / الزبون</span>
          <span className="ipd__info-value">{invoice.customerName || "-"}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">الفرع</span>
          <span className="ipd__info-value">{invoice.branchName || "-"}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">رقم الفاتورة</span>
          <span className="ipd__info-value">{invoice.invoiceNumber}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">العملة</span>
          <span className="ipd__info-value">{prepared.currencyLabel}</span>
        </div>
      </div>

      <section className="ipd__table-wrap">
        <table className="ipd__table">
          <thead>
            <tr>
              <th style={{ width: "7%" }}>#</th>
              <th className="ipd__th-name" style={{ width: prepared.hasCountColumn ? "38%" : "48%" }}>الصنف</th>
              {prepared.hasCountColumn ? <th style={{ width: "10%" }}>عدد</th> : null}
              <th style={{ width: "15%" }}>الكمية (كغ)</th>
              <th style={{ width: "15%" }}>سعر الوحدة</th>
              <th style={{ width: "17%" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {prepared.lines.length ? (
              prepared.lines.map((item, index) => (
                <tr key={`${item.itemName || item.rawName || "line"}-${index}`} className={index % 2 === 1 ? "ipd__row-alt" : ""}>
                  <td>{index + 1}</td>
                  <td className="ipd__item-name">{item.itemName || item.rawName || "-"}</td>
                  {prepared.hasCountColumn ? (
                    <td>{item.count == null || String(item.count).trim() === "" ? "-" : item.count}</td>
                  ) : null}
                  <td>{formatNumber(item.quantityKg)}</td>
                  <td>{formatCurrency(item.salePricePerKg, prepared.currency)}</td>
                  <td className="ipd__amount">{formatCurrency(item.revenue, prepared.currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={prepared.hasCountColumn ? 6 : 5} className="ipd__empty">
                  لا توجد بنود في هذه الفاتورة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {invoice.notes ? (
        <div className="ipd__notes">
          <div className="ipd__notes-label">ملاحظات</div>
          <div className="ipd__notes-body">{invoice.notes}</div>
        </div>
      ) : null}

      <div className="ipd__total-box">
        <span className="ipd__total-label">الإجمالي الكلي</span>
        <strong className="ipd__total-value">{formatCurrency(prepared.revenue, prepared.currency)}</strong>
      </div>

      <footer className="ipd__footer">شكراً لتعاملكم معنا</footer>
    </article>
  );
}
