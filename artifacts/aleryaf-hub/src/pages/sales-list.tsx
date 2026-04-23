import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/http";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity";
import { SalesListPrintDocument } from "@/components/sales-list-print-document";

type SalesPrintMode = "full" | "simple";
type SalesPrintLanguage = "ar" | "tr";
type SalesCurrency = "TRY" | "USD";

interface SalesLine {
  id: string;
  name: string;
  pricePerKg: number | null;
}

interface SavedSalesList {
  id: number;
  title: string;
  currency: SalesCurrency;
  printMode: SalesPrintMode;
  salesDate: string;
  notes: string;
  itemsText: string;
  totalAmount: number;
  createdBy: string | null;
  createdAt: string | null;
}

function getDefaultTitle(language: SalesPrintLanguage) {
  return language === "tr" ? "Satis Listesi" : "قائمة مبيعات";
}

function toAsciiDigits(value: string) {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";

  return value
    .split("")
    .map((char) => {
      const arabicIndex = arabicIndic.indexOf(char);
      if (arabicIndex >= 0) return String(arabicIndex);

      const easternArabicIndex = easternArabicIndic.indexOf(char);
      if (easternArabicIndex >= 0) return String(easternArabicIndex);

      return char;
    })
    .join("");
}

function parsePrice(rawPrice: string) {
  const normalized = toAsciiDigits(rawPrice).replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSalesLines(source: string): SalesLine[] {
  return source
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      const match = trimmed.match(/^(.*?)(?:\s+([\d٠-٩۰-۹,.\-]+))$/);
      const name = match?.[1]?.trim() || trimmed;
      const pricePerKg = match?.[2] ? parsePrice(match[2]) : null;

      return {
        id: `${index}-${name}`,
        name,
        pricePerKg,
      };
    })
    .filter((line): line is SalesLine => Boolean(line));
}

function serializeSalesLines(lines: SalesLine[]) {
  return lines
    .map((line) => {
      const price = line.pricePerKg == null ? "" : String(line.pricePerKg);
      return price ? `${line.name} ${price}` : line.name;
    })
    .join("\n");
}

function toPricePerTon(value: number | null) {
  if (value === null) return null;
  return value * 1000;
}

function formatDateByLanguage(value: string, language: SalesPrintLanguage) {
  if (!value) return "-";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "ar-SY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function formatPricePreview(value: number | null, currency: SalesCurrency) {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getTodayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SalesListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [printLanguage, setPrintLanguage] = useState<SalesPrintLanguage>("ar");
  const [currency, setCurrency] = useState<SalesCurrency>("TRY");
  const [documentDate, setDocumentDate] = useState(getTodayValue);
  const [printMode, setPrintMode] = useState<SalesPrintMode>("full");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SalesLine[]>([]);
  const [savedLists, setSavedLists] = useState<SavedSalesList[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSavedLists, setIsLoadingSavedLists] = useState(true);
  const [deletingSavedListId, setDeletingSavedListId] = useState<number | null>(null);
  const [activeSavedListId, setActiveSavedListId] = useState<number | null>(null);
  const [isNewItemOpen, setIsNewItemOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const itemsText = useMemo(() => serializeSalesLines(items), [items]);

  const loadSavedLists = async () => {
    setIsLoadingSavedLists(true);
    try {
      const response = await apiFetch("/api/sales-lists");
      if (!response.ok) {
        throw new Error("load failed");
      }
      const data = (await response.json()) as SavedSalesList[];
      setSavedLists(data);
    } catch {
      toast({
        title: "تعذر تحميل القوائم المحفوظة",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSavedLists(false);
    }
  };

  useEffect(() => {
    loadSavedLists().catch(() => undefined);
  }, []);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const handleReset = () => {
    setDocumentDate(getTodayValue());
    setPrintLanguage("ar");
    setCurrency("TRY");
    setPrintMode("full");
    setNotes("");
    setItems([]);
    setEditingItemId(null);
    setNewItemName("");
    setNewItemPrice("");
    setIsNewItemOpen(false);
    setActiveSavedListId(null);
  };

  const handleUpsertItem = () => {
    const normalizedName = newItemName.trim();
    const parsedPrice = parsePrice(newItemPrice);

    if (!normalizedName) {
      toast({
        title: "اكتب اسم المنتج أولًا",
        variant: "destructive",
      });
      return;
    }

    if (parsedPrice == null || parsedPrice < 0) {
      toast({
        title: "اكتب سعرًا صحيحًا للكيلو",
        variant: "destructive",
      });
      return;
    }

    setItems((current) => {
      if (editingItemId) {
        return current.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                name: normalizedName,
                pricePerKg: parsedPrice,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          name: normalizedName,
          pricePerKg: parsedPrice,
        },
      ];
    });
    setEditingItemId(null);
    setNewItemName("");
    setNewItemPrice("");
    setIsNewItemOpen(false);
  };

  const handleEditItem = (item: SalesLine) => {
    setEditingItemId(item.id);
    setNewItemName(item.name);
    setNewItemPrice(item.pricePerKg == null ? "" : String(item.pricePerKg));
    setIsNewItemOpen(true);
  };

  const handleRemoveItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast({
        title: "أضف عنصرًا واحدًا على الأقل",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = items.reduce((sum, line) => sum + (toPricePerTon(line.pricePerKg) ?? 0), 0);

    setIsSaving(true);
    try {
      const response = await apiFetch("/api/sales-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: getDefaultTitle(printLanguage),
          currency,
          printMode,
          salesDate: documentDate,
          notes,
          itemsText,
          totalAmount,
          createdBy: user?.username,
        }),
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      const saved = (await response.json()) as SavedSalesList;
      setSavedLists((current) => [saved, ...current]);
      setActiveSavedListId(saved.id);
      toast({
        title: "تم حفظ قائمة المبيعات",
      });
      if (user) {
        logActivity(
          user.username,
          "حفظ قائمة مبيعات",
          `${saved.title} | ${saved.salesDate} | ${currency} | ${printLanguage === "tr" ? "Türkçe" : "العربية"} | ${printMode === "full" ? "Tam Fatura" : "Faturasiz"}`,
        );
      }
    } catch {
      toast({
        title: "تعذر حفظ قائمة المبيعات",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadSavedListIntoEditor = (saved: SavedSalesList) => {
    const loadedItems = parseSalesLines(saved.itemsText);
    const inferredLanguage: SalesPrintLanguage = saved.title === "Satis Listesi" ? "tr" : "ar";

    setPrintLanguage(inferredLanguage);
    setCurrency(saved.currency ?? "TRY");
    setDocumentDate(saved.salesDate);
    setPrintMode(saved.printMode);
    setNotes(saved.notes);
    setItems(loadedItems);
    setActiveSavedListId(saved.id);
  };

  const handleDeleteSavedList = async (saved: SavedSalesList) => {
    setDeletingSavedListId(saved.id);
    try {
      const response = await apiFetch(`/api/sales-lists/${saved.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      setSavedLists((current) => current.filter((entry) => entry.id !== saved.id));
      if (activeSavedListId === saved.id) {
        setActiveSavedListId(null);
      }
      toast({
        title: "تم حذف القائمة المحفوظة",
      });
    } catch {
      toast({
        title: "تعذر حذف القائمة المحفوظة",
        variant: "destructive",
      });
    } finally {
      setDeletingSavedListId(null);
    }
  };

  return (
    <Layout>
      <div className="sales-list-page flex flex-col gap-4 sm:gap-6">
        <div className="screen-only flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="invoice-page-title font-display font-bold text-foreground">قائمة مبيعات</h1>
            <p className="invoice-page-subtitle">
              احفظ كل قائمة مبيعات مع تاريخها ونوعها ثم أعد فتحها أو اطبعها لاحقًا.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleReset}
              className="invoice-action-button border-white/10 text-white hover:bg-white/5"
            >
              <RotateCcw className="ml-2 h-4 w-4" />
              إعادة تعيين
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="invoice-action-button border-white/10 text-white hover:bg-white/5"
            >
              <Save className="ml-2 h-4 w-4" />
              {isSaving ? "جارٍ الحفظ..." : "حفظ القائمة"}
            </Button>
            <Button onClick={handlePrint} className="invoice-action-button invoice-action-button--primary text-white">
              <Printer className="ml-2 h-4 w-4" />
              طباعة / PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="screen-only border-white/8 bg-[#0f0f10] shadow-none">
            <CardContent className="space-y-5 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">لغة الـ PDF</label>
                  <div className="invoice-segmented flex items-center gap-1 rounded-2xl p-1">
                    <button
                      type="button"
                      onClick={() => setPrintLanguage("ar")}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        printLanguage === "ar" ? "invoice-segmented__active text-white" : "text-slate-300"
                      }`}
                    >
                      العربية
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintLanguage("tr")}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        printLanguage === "tr" ? "invoice-segmented__active text-white" : "text-slate-300"
                      }`}
                    >
                      Türkçe
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">التاريخ</label>
                  <Input
                    type="date"
                    value={documentDate}
                    onChange={(event) => setDocumentDate(event.target.value)}
                    className="invoice-input invoice-input--date text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">العملة</label>
                  <div className="invoice-segmented flex items-center gap-1 rounded-2xl p-1">
                    <button
                      type="button"
                      onClick={() => setCurrency("TRY")}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        currency === "TRY" ? "invoice-segmented__active text-white" : "text-slate-300"
                      }`}
                    >
                      TRY
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency("USD")}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        currency === "USD" ? "invoice-segmented__active text-white" : "text-slate-300"
                      }`}
                    >
                      USD
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">نوع الطباعة</label>
                  <div className="invoice-segmented flex items-center gap-1 rounded-2xl p-1">
                    <button
                      type="button"
                      onClick={() => setPrintMode("simple")}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        printMode === "simple" ? "invoice-segmented__active text-white" : "text-slate-300"
                      }`}
                    >
                      Faturasiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintMode("full")}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        printMode === "full" ? "invoice-segmented__active text-white" : "text-slate-300"
                      }`}
                    >
                      Tam Fatura
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-bold text-foreground">المنتجات والأسعار</label>
                    <p className="mt-1 text-xs text-muted-foreground">أدخل السعر بالكيلو، وسيظهر سعر الطن تلقائيًا داخل الـ PDF.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setIsNewItemOpen(true)}
                    className="invoice-action-button invoice-action-button--primary px-4 text-white"
                  >
                    <Plus className="ml-2 h-4 w-4" />
                    New Item
                  </Button>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
                    لا توجد عناصر بعد. اضغط <span className="font-bold text-foreground">New Item</span> لإضافة أول منتج.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">#{index + 1}</div>
                          <div className="truncate text-sm font-bold text-foreground">{item.name}</div>
                        </div>
                        <div className="flex items-center justify-between gap-3 md:min-w-[250px]">
                          <div className="text-left" dir="ltr">
                            <div className="text-xs text-muted-foreground">Kg</div>
                            <div className="text-sm font-bold text-foreground">{formatPricePreview(item.pricePerKg, currency)}</div>
                          </div>
                          <div className="text-left" dir="ltr">
                            <div className="text-xs text-muted-foreground">Ton</div>
                            <div className="text-sm font-bold text-foreground">
                              {formatPricePreview(toPricePerTon(item.pricePerKg), currency)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditItem(item)}
                            className="border-white/10 text-white hover:bg-white/5"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="border-white/10 text-white hover:bg-white/5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">ملاحظات</label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="invoice-input min-h-[110px] resize-y"
                  dir={printLanguage === "tr" ? "ltr" : "rtl"}
                  placeholder="ملاحظات التسليم أو التوضيح"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="screen-only border-white/8 bg-[#0f0f10] shadow-none">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">القوائم المحفوظة</h2>
                  <p className="mt-1 text-xs text-muted-foreground">كل قائمة تحفظ مع التاريخ والنوع والإجمالي.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadSavedLists().catch(() => undefined)}
                  className="border-white/10 text-white hover:bg-white/5"
                >
                  <Download className="ml-2 h-3.5 w-3.5" />
                  تحديث
                </Button>
              </div>

              <div className="sales-saved-list">
                {isLoadingSavedLists ? (
                  <div className="sales-saved-list__empty">جارٍ تحميل القوائم...</div>
                ) : savedLists.length === 0 ? (
                  <div className="sales-saved-list__empty">لا توجد قوائم مبيعات محفوظة بعد.</div>
                ) : (
                  savedLists.map((saved) => (
                    <div
                      key={saved.id}
                      className={`sales-saved-card ${
                        activeSavedListId === saved.id ? "sales-saved-card--active" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => loadSavedListIntoEditor(saved)}
                          className="min-w-0 flex-1 text-right"
                        >
                          <div className="truncate text-sm font-bold text-foreground">{saved.title}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {formatDateByLanguage(saved.salesDate, printLanguage)}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="sales-saved-card__badge">
                            {(saved.currency ?? "TRY")} • {saved.printMode === "full" ? "Tam Fatura" : "Faturasiz"}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={deletingSavedListId === saved.id}
                            onClick={() => handleDeleteSavedList(saved)}
                            className="border-white/10 text-white hover:bg-white/5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="print-only sales-print-stage">
          <div className="invoice-print-sheet">
            <SalesListPrintDocument
              language={printLanguage}
              currency={currency}
              printMode={printMode}
              showMode
              salesDate={documentDate}
              notes={notes}
              lines={items.map((line) => ({
                name: line.name,
                pricePerKg: line.pricePerKg,
                pricePerTon: toPricePerTon(line.pricePerKg),
              }))}
            />
          </div>
        </div>

        <Dialog open={isNewItemOpen} onOpenChange={setIsNewItemOpen}>
          <DialogContent className="border-white/10 bg-[#101114] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItemId ? "Edit Item" : "New Item"}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingItemId
                  ? "عدّل اسم المنتج وسعر الكيلو وسيتم تحديثه مباشرة في القائمة وداخل الـ PDF."
                  : "أضف اسم المنتج وسعر الكيلو، وسيتم إدراجه مباشرة في القائمة وداخل الـ PDF."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">اسم المنتج</label>
                <Input
                  value={newItemName}
                  onChange={(event) => setNewItemName(event.target.value)}
                  className="invoice-input"
                  placeholder="مثال: فلفل أحمر"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">سعر الكيلو</label>
                <Input
                  value={newItemPrice}
                  onChange={(event) => setNewItemPrice(event.target.value)}
                  className="invoice-input text-left"
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="25"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewItemOpen(false);
                  setEditingItemId(null);
                  setNewItemName("");
                  setNewItemPrice("");
                }}
                className="border-white/10 text-white hover:bg-white/5"
              >
                إلغاء
              </Button>
              <Button type="button" onClick={handleUpsertItem} className="invoice-action-button invoice-action-button--primary text-white">
                {editingItemId ? "حفظ التعديل" : "إضافة المنتج"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
