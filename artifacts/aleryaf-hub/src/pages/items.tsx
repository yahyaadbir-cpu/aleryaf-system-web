import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetItems, useCreateItem, useDeleteItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Plus, Search, Trash2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

const itemSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب"),
});

export function ItemsPage() {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useGetItems({ search: search || undefined });
  
  const { mutate: createItem, isPending: isCreating } = useCreateItem({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم إضافة المنتج" });
        setIsAddOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      }
    }
  });

  const { mutate: deleteItem } = useDeleteItem({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الحذف بنجاح" });
        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      }
    }
  });

  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: "" }
  });

  function onSubmit(values: z.infer<typeof itemSchema>) {
    const nextCodeNumber = ((items ?? []).reduce((max, item) => {
      const match = item.code.match(/(\d+)(?!.*\d)/);
      return Math.max(max, match ? parseInt(match[1], 10) : 0);
    }, 0) + 1);
    createItem({ data: { name: values.name, code: `ITEM-${nextCodeNumber.toString().padStart(4, "0")}` } });
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">إدارة المنتجات</h1>
            <p className="text-sm text-muted-foreground mt-1">إدارة بيانات المنتجات والأسماء البديلة</p>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover-elevate">
                <Plus className="w-4 h-4 ml-2" />
                منتج جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة منتج جديد</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>اسم المنتج</FormLabel><FormControl><Input {...field} className="bg-black/50" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" disabled={isCreating} className="w-full">
                    {isCreating ? "جاري الحفظ..." : "حفظ المنتج"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
            <CardTitle className="font-display">قائمة المنتجات</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="بحث..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9 bg-black/20 border-white/10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-white/10 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10">
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-left w-20">حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                  ) : items?.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا توجد منتجات</TableCell></TableRow>
                  ) : items?.map((item) => (
                    <TableRow key={item.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.name}</span>
                          {item.nameAr && <span className="block text-xs text-muted-foreground">{item.nameAr}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if(confirm('هل أنت متأكد من حذف هذا المنتج؟')) deleteItem({ id: item.id })
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
