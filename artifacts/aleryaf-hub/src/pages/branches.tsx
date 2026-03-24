import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetBranches,
  useCreateBranch,
  useDeleteBranch,
  useGetWarehouses,
  useCreateWarehouse,
  useDeleteWarehouse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

const branchSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  code: z.string().min(1, "الكود مطلوب"),
  isActive: z.boolean().default(true),
});

const warehouseSchema = z.object({
  name: z.string().trim().min(1, "اسم المستودع مطلوب"),
  branchId: z.coerce.number().min(1, "الفرع مطلوب"),
});

export function BranchesPage() {
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches, isLoading: isBranchesLoading } = useGetBranches();
  const { data: warehouses, isLoading: isWarehousesLoading } = useGetWarehouses();

  const branchForm = useForm<z.infer<typeof branchSchema>>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: "", code: "", isActive: true },
  });

  const warehouseForm = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { name: "", branchId: 0 },
  });

  const { mutate: createBranch, isPending: isCreatingBranch } = useCreateBranch({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم إضافة الفرع" });
        setIsAddBranchOpen(false);
        branchForm.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      },
    },
  });

  const { mutate: deleteBranch } = useDeleteBranch({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الحذف بنجاح" });
        queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      },
    },
  });

  const { mutate: createWarehouse, isPending: isCreatingWarehouse } = useCreateWarehouse({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم إضافة المستودع" });
        setIsAddWarehouseOpen(false);
        warehouseForm.reset({ name: "", branchId: 0 });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      },
    },
  });

  const { mutate: deleteWarehouse } = useDeleteWarehouse({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم حذف المستودع" });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      },
    },
  });

  function onSubmitBranch(values: z.infer<typeof branchSchema>) {
    createBranch({ data: values });
  }

  function onSubmitWarehouse(values: z.infer<typeof warehouseSchema>) {
    createWarehouse({
      data: {
        name: values.name.trim(),
        branchId: values.branchId,
      },
    });
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">إدارة الفروع والمستودعات</h1>
            <p className="text-sm text-muted-foreground mt-1">إدارة الفروع والمستودعات المسجلة في النظام</p>
          </div>
        </div>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-display">قائمة الفروع المسجلة</CardTitle>
            </div>
            <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover-elevate">
                  <Plus className="w-4 h-4 ml-2" />
                  فرع جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-white/10 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>إضافة فرع جديد</DialogTitle>
                </DialogHeader>
                <Form {...branchForm}>
                  <form onSubmit={branchForm.handleSubmit(onSubmitBranch)} className="space-y-4 pt-4">
                    <FormField
                      control={branchForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم الفرع</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-black/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={branchForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>كود الفرع (للعرض)</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-black/50 font-mono text-left" dir="ltr" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isCreatingBranch} className="w-full">
                      {isCreatingBranch ? "جاري الحفظ..." : "حفظ الفرع"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-white/10 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10">
                    <TableHead className="text-right w-[100px]">الكود</TableHead>
                    <TableHead className="text-right">اسم الفرع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-left w-16">حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isBranchesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                  ) : branches?.map((branch) => (
                    <TableRow key={branch.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-mono font-medium text-muted-foreground">{branch.code}</TableCell>
                      <TableCell className="font-bold text-lg">{branch.nameAr || branch.name}</TableCell>
                      <TableCell>
                        {branch.isActive ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/30">نشط</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">غير نشط</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذا الفرع؟ سيؤثر على السجلات المرتبطة به.")) {
                              deleteBranch({ id: branch.id });
                            }
                          }}
                          className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-display flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-primary" />
                قائمة المستودعات
              </CardTitle>
            </div>
            <Dialog open={isAddWarehouseOpen} onOpenChange={setIsAddWarehouseOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover-elevate">
                  <Plus className="w-4 h-4 ml-2" />
                  مستودع جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-white/10 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>إضافة مستودع جديد</DialogTitle>
                </DialogHeader>
                <Form {...warehouseForm}>
                  <form onSubmit={warehouseForm.handleSubmit(onSubmitWarehouse)} className="space-y-4 pt-4">
                    <FormField
                      control={warehouseForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المستودع</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-black/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={warehouseForm.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الفرع</FormLabel>
                          <Select
                            value={field.value > 0 ? field.value.toString() : undefined}
                            onValueChange={(value) => field.onChange(Number(value))}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-black/50 border-white/10">
                                <SelectValue placeholder="اختر الفرع" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {branches?.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id.toString()}>
                                  {branch.nameAr || branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isCreatingWarehouse} className="w-full">
                      {isCreatingWarehouse ? "جاري الحفظ..." : "حفظ المستودع"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-white/10 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10">
                    <TableHead className="text-right">اسم المستودع</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-left w-16">حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isWarehousesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                  ) : warehouses?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد مستودعات</TableCell></TableRow>
                  ) : warehouses?.map((warehouse) => (
                    <TableRow key={warehouse.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-bold">{warehouse.name}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{warehouse.branchName}</span>
                          {warehouse.branchCode && (
                            <span className="block text-xs font-mono text-muted-foreground">{warehouse.branchCode}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {warehouse.isActive ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/30">نشط</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">غير نشط</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذا المستودع؟")) {
                              deleteWarehouse({ id: warehouse.id });
                            }
                          }}
                          className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
