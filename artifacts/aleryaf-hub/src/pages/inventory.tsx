import { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useGetInventory, useGetWarehouses, useImportInventory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Upload, AlertTriangle, Search, Info, Package, FileSpreadsheet, X, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface ParsedRow {
  itemCode: string;
  rawName: string;
  quantity: number;
  unit: string;
  costUsd?: number;
  costTry?: number;
  totalValue?: number;
}

interface ParsedFile {
  fileName: string;
  sourceName: string;
  currency: string;
  rows: ParsedRow[];
}

const arabicAlefVariants = /[أإآٱ]/g;
const arabicTatweel = /\u0640/g;

function normalizeArabicText(value?: string | null) {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(arabicTatweel, "")
    .replace(arabicAlefVariants, "ا")
    .replace(/\s+/g, " ");
}

function normalizeHeader(value?: string | null) {
  return normalizeArabicText(value).replace(/\s+/g, "");
}

function normalizeUnit(value?: string | null) {
  const normalized = normalizeHeader(value);
  if (["كغ", "كجم", "kg", "كيلو", "كيلوغرام", "كيلوجرام"].includes(normalized)) return "كغ";
  return (value ?? "").toString().trim();
}

function isSummaryRow(rawName?: string | null, itemCode?: string | null) {
  const normalizedName = normalizeArabicText(rawName);
  const normalizedCode = normalizeArabicText(itemCode);
  if (!normalizedName && !normalizedCode) return true;
  return (
    normalizedName === "المجموع" ||
    normalizedName === "عدد المواد المظهره" ||
    normalizedName === "عدد المواد المظهرة" ||
    normalizedName.startsWith("المجموع") ||
    normalizedName.startsWith("عدد المواد المظهره") ||
    normalizedName.startsWith("عدد المواد المظهرة")
  );
}

function parseNumeric(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = parseFloat(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderRow(raw: unknown[][]) {
  const requiredHeaders = [
    normalizeHeader("اسم المادة"),
    normalizeHeader("الكمية"),
    normalizeHeader("الوحدة"),
    normalizeHeader("التكلفة"),
  ];

  for (let index = 0; index < raw.length; index++) {
    const row = raw[index] ?? [];
    const normalizedCells = row.map((cell) => normalizeHeader(String(cell ?? "")));
    if (requiredHeaders.every((header) => normalizedCells.includes(header))) {
      return { headerRow: row, headerIndex: index };
    }
  }

  return null;
}

function findColumnIndex(headers: unknown[], candidates: string[], fallback = -1) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) =>
    normalizedCandidates.includes(normalizeHeader(String(header ?? ""))),
  ) ?? fallback;
}

function detectCurrency(lines: unknown[][], headerIndex: number) {
  const text = lines
    .slice(0, headerIndex)
    .flat()
    .map((value) => String(value ?? ""))
    .join(" ");

  if (text.includes("دولار") || text.includes("USD")) return "USD";
  if (text.includes("ليرة") || text.includes("TRY") || text.includes("تركي")) return "TRY";
  return "USD";
}

function parseExcelFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

        const headerMatch = findHeaderRow(raw);
        if (!headerMatch) {
          reject(new Error("تعذر العثور على صف العناوين الرسمي في ملف Excel"));
          return;
        }

        const { headerRow, headerIndex } = headerMatch;
        const sourceName = String(raw[0]?.[0] || file.name).trim();
        const currency = detectCurrency(raw, headerIndex);

        const codeIndex = findColumnIndex(headerRow, ["رقم المادة", "رقم الماده", "الكود", "رمز المادة"]);
        const nameIndex = findColumnIndex(headerRow, ["اسم المادة", "اسم الماده"]);
        const quantityIndex = findColumnIndex(headerRow, ["الكمية", "الكميه"]);
        const unitIndex = findColumnIndex(headerRow, ["الوحدة", "الوحده"]);
        const costIndex = findColumnIndex(headerRow, ["التكلفة", "التكلفه", "cost", "unit cost"]);

        if (nameIndex < 0 || quantityIndex < 0 || unitIndex < 0 || costIndex < 0) {
          reject(new Error("ملف Excel لا يحتوي على أعمدة اسم المادة / الكمية / الوحدة / التكلفة بشكل صحيح"));
          return;
        }

        const rows: ParsedRow[] = [];
        for (let rowIndex = headerIndex + 1; rowIndex < raw.length; rowIndex++) {
          const row = raw[rowIndex];
          if (!row || row.every((cell) => String(cell ?? "").trim() === "")) continue;

          const itemCode = codeIndex >= 0 ? String(row[codeIndex] || "").trim() : "";
          const rawName = String(row[nameIndex] || "").trim();
          const quantity = parseNumeric(row[quantityIndex]);
          const unit = normalizeUnit(row[unitIndex] || "كغ");
          const costPerKg = parseNumeric(row[costIndex]);

          if (!itemCode && !rawName) continue;
          if (isSummaryRow(rawName, itemCode)) continue;
          if (quantity == null || quantity <= 0) continue;
          if (!unit || unit !== "كغ") {
            reject(new Error(`وحدة غير مدعومة في الصف ${rowIndex + 1}: ${String(row[unitIndex] || "-")}`));
            return;
          }
          if (costPerKg == null || costPerKg < 0) {
            reject(new Error(`قيمة تكلفة غير صالحة في الصف ${rowIndex + 1}`));
            return;
          }

          const parsedRow: ParsedRow = {
            itemCode,
            rawName,
            quantity,
            unit,
            totalValue: quantity * costPerKg,
          };

          if (currency === "USD") {
            parsedRow.costUsd = costPerKg;
          } else {
            parsedRow.costTry = costPerKg;
          }

          rows.push(parsedRow);
        }

        resolve({ fileName: file.name, sourceName, currency, rows });
      } catch {
        reject(new Error("خطأ في قراءة الملف"));
      }
    };
    reader.onerror = () => reject(new Error("خطأ في قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

function formatInventoryValue(amount: number | null | undefined, currency: "TRY" | "USD" | null | undefined) {
  if (amount == null || currency == null) return "-";
  return formatCurrency(amount, currency);
}

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [importDate, setImportDate] = useState(new Date().toISOString().split("T")[0]);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: inventory, isLoading } = useGetInventory({ search: search || undefined });
  const { data: warehouses } = useGetWarehouses();

  const { mutate: doImport, isPending: isImporting } = useImportInventory({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "تم الاستيراد بنجاح",
          description: `تمت معالجة ${data.rowsProcessed} سجل (${data.rowsMatched} مطابق، ${data.rowsUnmatched} غير مطابق).`,
        });
        setIsImportOpen(false);
        setParsedFiles([]);
        setParseError(null);
        setWarehouseId("");
        queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
        queryClient.invalidateQueries({ queryKey: ["/api/inventory/imports"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      },
      onError: () => {
        toast({ title: "خطأ في الاستيراد", variant: "destructive" });
      },
    },
  });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setParseError(null);
    const xlsxFiles = Array.from(files).filter((file) => file.name.endsWith(".xlsx") || file.name.endsWith(".xls"));
    if (xlsxFiles.length === 0) {
      setParseError("يرجى اختيار ملفات Excel (.xlsx أو .xls)");
      return;
    }

    const results = await Promise.allSettled(xlsxFiles.map((file) => parseExcelFile(file)));
    const succeeded = results
      .filter((result): result is PromiseFulfilledResult<ParsedFile> => result.status === "fulfilled")
      .map((result) => result.value);
    const failed = results.filter((result) => result.status === "rejected");

    if (succeeded.length > 0) setParsedFiles((prev) => [...prev, ...succeeded]);
    if (failed.length > 0) {
      setParseError(String(failed[0].reason?.message || "فشل في قراءة ملف Excel"));
    }
  }, []);

  const removeFile = (idx: number) => {
    setParsedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImport = () => {
    const allRows = parsedFiles.flatMap((file) => file.rows);
    if (!warehouseId) {
      setParseError("يرجى اختيار المستودع قبل تنفيذ الاستيراد");
      return;
    }
    if (allRows.length === 0) {
      setParseError("لا توجد بيانات صالحة للاستيراد");
      return;
    }
    doImport({ data: { importDate, warehouseId: Number(warehouseId), rows: allRows } });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const totalParsedRows = parsedFiles.reduce((sum, file) => sum + file.rows.length, 0);
  const totalItems = inventory?.length || 0;
  const lowStockItems = inventory?.filter((item) => item.isLowStock).length || 0;
  const totalValueUsd = inventory?.reduce((sum, item) => sum + (item.inventoryValueUsd || 0), 0) || 0;
  const totalValueTry = inventory?.reduce((sum, item) => sum + (item.inventoryValueTry || 0), 0) || 0;

  return (
    <Layout>
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">المخزون</h1>
            <p className="text-sm text-muted-foreground mt-1">الاستيراد الرسمي الآن كغ فقط، وكل القيم المعروضة هنا هي كمية بالكغ وتكلفة لكل كغ.</p>
          </div>

          <Dialog
            open={isImportOpen}
            onOpenChange={(open) => {
              setIsImportOpen(open);
              if (!open) {
                setParsedFiles([]);
                setParseError(null);
                setWarehouseId("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover-elevate">
                <Upload className="w-4 h-4 ml-2" />
                استيراد مخزون
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 sm:max-w-xl max-h-[85vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="font-display">استيراد المخزون الرسمي</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">المستودع</label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger className="bg-black/50 border-white/10">
                      <SelectValue placeholder="اختر المستودع" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300 flex gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>يتم اعتماد أعمدة: اسم المادة، الكمية، الوحدة، التكلفة. الكمية تعني كغ مباشرة، والتكلفة تعني تكلفة لكل كغ.</span>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">تاريخ الاستيراد</label>
                  <Input type="date" value={importDate} onChange={(e) => setImportDate(e.target.value)} className="bg-black/50 border-white/10" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">ملفات Excel</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                      isDragging ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                    }`}
                  >
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">اضغط لاختيار الملفات أو اسحبها هنا</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">xlsx, xls</p>
                  </div>
                </div>

                {parseError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-sm text-rose-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {parseError}
                  </div>
                )}

                {parsedFiles.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">الملفات المحملة ({parsedFiles.length})</label>
                    {parsedFiles.map((file, idx) => (
                      <div key={idx} className="bg-black/30 border border-white/10 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-sm font-medium truncate">{file.sourceName || file.fileName}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeFile(idx)} className="h-6 w-6 text-muted-foreground hover:text-rose-400 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="border-white/10 bg-white/5">
                            {file.rows.length} منتج
                          </Badge>
                          <Badge variant="outline" className={`border-white/10 ${file.currency === "USD" ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"}`}>
                            {file.currency}
                          </Badge>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
                            {file.fileName}
                          </Badge>
                        </div>
                      </div>
                    ))}

                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-primary font-medium">إجمالي الصفوف الجاهزة للاستيراد</span>
                        <span className="font-bold text-primary text-lg">{totalParsedRows}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={handleImport} disabled={isImporting || parsedFiles.length === 0 || !warehouseId} className="w-full bg-primary text-white">
                  {isImporting ? (
                    "جاري الاستيراد..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      تنفيذ الاستيراد ({totalParsedRows} صف)
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card className="glass-panel">
            <CardContent className="p-3 sm:p-5">
              <p className="text-[11px] sm:text-sm text-muted-foreground">إجمالي المنتجات</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">{formatNumber(totalItems)}</h3>
            </CardContent>
          </Card>
          <Card className="glass-panel border-rose-500/20">
            <CardContent className="p-3 sm:p-5">
              <p className="text-[11px] sm:text-sm text-rose-400">مخزون منخفض</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1 text-rose-500">{formatNumber(lowStockItems)}</h3>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-3 sm:p-5">
              <p className="text-[11px] sm:text-sm text-muted-foreground">القيمة الحالية</p>
              <div className="mt-1 space-y-1">
                <h3 className="text-base sm:text-xl font-bold text-primary">{formatCurrency(totalValueUsd, "USD")}</h3>
                <p className="text-xs sm:text-sm text-orange-400">{formatCurrency(totalValueTry, "TRY")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
            <CardTitle className="font-display">المخزون بالكيلوغرام</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في المنتجات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 bg-black/20 border-white/10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">

            {/* Desktop table */}
            <div className="hidden sm:block rounded-md border border-white/10 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10">
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الوحدة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">التكلفة/كغ</TableHead>
                    <TableHead className="text-right text-primary font-bold">الرصيد الحالي (كغ)</TableHead>
                    <TableHead className="text-right hidden md:table-cell">القيمة الحالية</TableHead>
                    <TableHead className="text-right">المستودع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                    </TableRow>
                  ) : inventory?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        لا توجد بيانات مخزون. قم باستيراد ملف Excel الرسمي.
                      </TableCell>
                    </TableRow>
                  ) : inventory?.map((item) => (
                    <TableRow key={item.itemId} className={`border-white/5 hover:bg-white/5 ${item.isLowStock ? "bg-rose-500/5" : ""}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.itemCode}</TableCell>
                      <TableCell className="font-medium text-sm">{item.itemName}</TableCell>
                      <TableCell className="hidden md:table-cell">{item.unitDisplay || "كغ"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatInventoryValue(item.costPerKg, item.currency)}</TableCell>
                      <TableCell className={`font-bold ${item.isLowStock ? "text-rose-500" : "text-primary"}`}>
                        {formatNumber(item.currentBalanceKg || 0)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatInventoryValue(item.currentValue, item.currency)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {((item as any).warehouses as string[] || []).length > 0
                            ? ((item as any).warehouses as string[]).map((wh) => (
                                <Badge key={wh} variant="outline" className="text-[10px] bg-white/5 border-white/10 whitespace-nowrap">
                                  {wh}
                                </Badge>
                              ))
                            : <span className="text-xs text-muted-foreground">—</span>
                          }
                          {item.isLowStock && (
                            <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3 ml-1" />
                              منخفض
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 p-3 sm:hidden">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>
              ) : inventory?.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  لا توجد بيانات مخزون
                </div>
              ) : inventory?.map((item) => (
                <div
                  key={item.itemId}
                  className={`rounded-xl border p-3.5 ${item.isLowStock ? "border-rose-500/30 bg-rose-500/5" : "border-white/10 bg-white/[0.03]"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground">{item.itemName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{item.itemCode}</div>
                    </div>
                    {item.isLowStock && (
                      <Badge variant="outline" className="shrink-0 text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                        <AlertTriangle className="w-3 h-3 ml-1" />
                        منخفض
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">الرصيد الحالي</div>
                      <div className={`text-sm font-bold ${item.isLowStock ? "text-rose-400" : "text-primary"}`}>
                        {formatNumber(item.currentBalanceKg || 0)} {item.unitDisplay || "كغ"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">القيمة الحالية</div>
                      <div className="text-sm font-bold">{formatInventoryValue(item.currentValue, item.currency)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">التكلفة/كغ</div>
                      <div className="text-sm">{formatInventoryValue(item.costPerKg, item.currency)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">العملة</div>
                      <div className="text-sm">{item.currency || "—"}</div>
                    </div>
                  </div>

                  {((item as any).warehouses as string[] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/8">
                      {((item as any).warehouses as string[]).map((wh) => (
                        <Badge key={wh} variant="outline" className="text-[10px] bg-white/5 border-white/10">
                          {wh}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
