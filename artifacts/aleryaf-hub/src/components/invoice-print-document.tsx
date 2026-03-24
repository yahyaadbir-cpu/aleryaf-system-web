import { APP_NAME_AR, APP_NAME_EN } from "@/lib/branding";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { preparePrintInvoice, type PrintInvoiceData } from "@/lib/print-invoice";

export function InvoicePrintDocument({ invoice }: { invoice: PrintInvoiceData }) {
  const prepared = preparePrintInvoice(invoice);
  const totalQuantityKg = prepared.lines.reduce((sum, item) => sum + item.quantityKg, 0);

  return (
    <article className="ipd" dir="rtl">
      <div className="ipd__topbar" />

      <header className="ipd__header">
        <div className="ipd__brand">
          <div className="ipd__brand-mark">ALERYAF</div>
          <div className="ipd__brand-ar">{APP_NAME_AR}</div>
          <div className="ipd__brand-en">{APP_NAME_EN}</div>
        </div>

        <div className="ipd__title-block">
          <div className="ipd__badge">فاتورة مبيعات</div>
          <div className="ipd__title">فاتورة</div>
          <div className="ipd__meta-stack">
            <div className="ipd__meta-line">
              <span className="ipd__meta-key">رقم الفاتورة</span>
              <span className="ipd__meta-value">{invoice.invoiceNumber}</span>
            </div>
            <div className="ipd__meta-line">
              <span className="ipd__meta-key">التاريخ</span>
              <span className="ipd__meta-value">{formatDate(invoice.invoiceDate)}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="ipd__info-grid">
        <div className="ipd__info-box">
          <span className="ipd__info-label">العميل / الزبون</span>
          <span className="ipd__info-value">{invoice.customerName || "-"}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">الفرع</span>
          <span className="ipd__info-value">{invoice.branchName || "-"}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">العملة</span>
          <span className="ipd__info-value">{prepared.currencyLabel}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">عدد البنود</span>
          <span className="ipd__info-value">{formatNumber(prepared.lines.length)}</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">إجمالي الكمية</span>
          <span className="ipd__info-value">{formatNumber(totalQuantityKg)} كغ</span>
        </div>
        <div className="ipd__info-box">
          <span className="ipd__info-label">حالة المستند</span>
          <span className="ipd__info-value">جاهز للطباعة</span>
        </div>
      </section>

      <section className="ipd__table-wrap">
        <table className="ipd__table">
          <thead>
            <tr>
              <th style={{ width: "7%" }}>#</th>
              <th className="ipd__th-name" style={{ width: prepared.hasCountColumn ? "36%" : "46%" }}>
                الصنف
              </th>
              {prepared.hasCountColumn ? <th style={{ width: "10%" }}>عدد</th> : null}
              <th style={{ width: "15%" }}>الكمية (كغ)</th>
              <th style={{ width: "15%" }}>سعر الوحدة</th>
              <th style={{ width: "17%" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {prepared.lines.length ? (
              prepared.lines.map((item, index) => (
                <tr
                  key={`${item.itemName || item.rawName || "line"}-${index}`}
                  className={index % 2 === 1 ? "ipd__row-alt" : ""}
                >
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

      <section className="ipd__summary">
        {invoice.notes ? (
          <div className="ipd__notes">
            <div className="ipd__notes-label">ملاحظات</div>
            <div className="ipd__notes-body">{invoice.notes}</div>
          </div>
        ) : (
          <div className="ipd__notes ipd__notes--muted">
            <div className="ipd__notes-label">ملاحظات</div>
            <div className="ipd__notes-body">لا توجد ملاحظات مضافة على هذه الفاتورة.</div>
          </div>
        )}

        <div className="ipd__summary-box">
          <div className="ipd__summary-row">
            <span>إجمالي البنود</span>
            <strong>{formatNumber(prepared.lines.length)}</strong>
          </div>
          <div className="ipd__summary-row">
            <span>إجمالي الكمية</span>
            <strong>{formatNumber(totalQuantityKg)} كغ</strong>
          </div>
          <div className="ipd__summary-row ipd__summary-row--grand">
            <span>الإجمالي الكلي</span>
            <strong>{formatCurrency(prepared.revenue, prepared.currency)}</strong>
          </div>
        </div>
      </section>

      <footer className="ipd__footer">
        <div className="ipd__footer-title">شكرًا لتعاملكم معنا</div>
        <div className="ipd__footer-subtitle">تم إعداد هذه الفاتورة إلكترونيًا من نظام شركة الأرياف التجارية</div>
      </footer>
    </article>
  );
}
