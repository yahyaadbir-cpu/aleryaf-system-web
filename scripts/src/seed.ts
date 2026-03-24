import { db, branchesTable, itemsTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Branches
  const branches = await db.insert(branchesTable).values([
    { name: "الفرع الرئيسي", nameAr: "الفرع الرئيسي", code: "MAIN", isActive: true },
    { name: "فرع المدينة", nameAr: "فرع المدينة", code: "CITY", isActive: true },
    { name: "فرع الشمال", nameAr: "فرع الشمال", code: "NORTH", isActive: true },
  ]).onConflictDoNothing().returning();
  console.log(`Inserted ${branches.length} branches`);

  // Items
  const items = await db.insert(itemsTable).values([
    { code: "ITM001", name: "قماش قطني أبيض", nameAr: "قماش قطني أبيض", category: "أقمشة", unitCostTry: "45.00", unitCostUsd: "1.80", unitPriceTry: "65.00", unitPriceUsd: "2.60", currentStock: "500", minStock: "50" },
    { code: "ITM002", name: "قماش حرير", nameAr: "قماش حرير", category: "أقمشة", unitCostTry: "120.00", unitCostUsd: "4.80", unitPriceTry: "180.00", unitPriceUsd: "7.20", currentStock: "200", minStock: "30" },
    { code: "ITM003", name: "خيط بوليستر", nameAr: "خيط بوليستر", category: "خيوط", unitCostTry: "15.00", unitCostUsd: "0.60", unitPriceTry: "22.00", unitPriceUsd: "0.88", currentStock: "1000", minStock: "100" },
    { code: "ITM004", name: "أزرار بلاستيك", nameAr: "أزرار بلاستيك", category: "إكسسوارات", unitCostTry: "8.00", unitCostUsd: "0.32", unitPriceTry: "14.00", unitPriceUsd: "0.56", currentStock: "5000", minStock: "500" },
    { code: "ITM005", name: "قماش دنيم أزرق", nameAr: "قماش دنيم أزرق", category: "أقمشة", unitCostTry: "90.00", unitCostUsd: "3.60", unitPriceTry: "130.00", unitPriceUsd: "5.20", currentStock: "300", minStock: "40" },
    { code: "ITM006", name: "سحاب معدني", nameAr: "سحاب معدني", category: "إكسسوارات", unitCostTry: "12.00", unitCostUsd: "0.48", unitPriceTry: "20.00", unitPriceUsd: "0.80", currentStock: "2000", minStock: "200" },
    { code: "ITM007", name: "قماش صوف", nameAr: "قماش صوف", category: "أقمشة", unitCostTry: "200.00", unitCostUsd: "8.00", unitPriceTry: "280.00", unitPriceUsd: "11.20", currentStock: "150", minStock: "20" },
    { code: "ITM008", name: "بطانة خفيفة", nameAr: "بطانة خفيفة", category: "بطانات", unitCostTry: "25.00", unitCostUsd: "1.00", unitPriceTry: "38.00", unitPriceUsd: "1.52", currentStock: "400", minStock: "50" },
  ]).onConflictDoNothing().returning();
  console.log(`Inserted ${items.length} items`);

  // Get IDs for seeded items
  const allItems = await db.select().from(itemsTable);
  const allBranches = await db.select().from(branchesTable);
  
  if (allItems.length === 0 || allBranches.length === 0) {
    console.log("No items or branches found, skipping invoices");
    return;
  }

  const item1 = allItems.find(i => i.code === "ITM001");
  const item2 = allItems.find(i => i.code === "ITM002");
  const item3 = allItems.find(i => i.code === "ITM003");
  const item4 = allItems.find(i => i.code === "ITM004");
  const item5 = allItems.find(i => i.code === "ITM005");
  const branch1 = allBranches.find(b => b.code === "MAIN");
  const branch2 = allBranches.find(b => b.code === "CITY");
  const branch3 = allBranches.find(b => b.code === "NORTH");

  if (!item1 || !item2 || !branch1 || !branch2 || !branch3) {
    console.log("Missing items/branches for invoices");
    return;
  }

  // Helper to create invoice with items
  async function createInvoice(
    invoiceNumber: string,
    branchId: number,
    currency: string,
    invoiceDate: string,
    invoiceItemsData: Array<{ itemId: number; rawName: string; qty: number; price: number; cost: number }>
  ) {
    let totalAmount = 0;
    let totalCost = 0;
    for (const item of invoiceItemsData) {
      totalAmount += item.qty * item.price;
      totalCost += item.qty * item.cost;
    }
    const totalProfit = totalAmount - totalCost;

    const [inv] = await db.insert(invoicesTable).values({
      invoiceNumber,
      branchId,
      currency,
      invoiceDate,
      totalAmount: totalAmount.toString(),
      totalCost: totalCost.toString(),
      totalProfit: totalProfit.toString(),
    }).onConflictDoNothing().returning();
    
    if (!inv) return;

    await db.insert(invoiceItemsTable).values(
      invoiceItemsData.map(item => ({
        invoiceId: inv.id,
        itemId: item.itemId,
        rawName: item.rawName,
        quantity: item.qty.toString(),
        unitPrice: item.price.toString(),
        unitCost: item.cost.toString(),
        totalPrice: (item.qty * item.price).toString(),
        totalCost: (item.qty * item.cost).toString(),
      }))
    );
  }

  // Seed invoices for the last 3 months
  const now = new Date();
  let invNum = 1000;

  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    for (let day = 1; day <= Math.min(daysInMonth, 28); day += 2) {
      const dateStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Main branch TRY invoice
      await createInvoice(`INV${++invNum}`, branch1.id, "TRY", dateStr, [
        { itemId: item1.id, rawName: item1.name, qty: Math.floor(Math.random() * 50) + 10, price: 65, cost: 45 },
        { itemId: item2.id, rawName: item2.name, qty: Math.floor(Math.random() * 20) + 5, price: 180, cost: 120 },
      ]);

      // City branch USD invoice  
      await createInvoice(`INV${++invNum}`, branch2.id, "USD", dateStr, [
        { itemId: item1.id, rawName: item1.name, qty: Math.floor(Math.random() * 30) + 5, price: 2.60, cost: 1.80 },
        { itemId: item5?.id ?? item1.id, rawName: item5?.name ?? item1.name, qty: Math.floor(Math.random() * 15) + 3, price: 5.20, cost: 3.60 },
      ]);

      // North branch TRY invoice
      if (day % 4 === 1) {
        await createInvoice(`INV${++invNum}`, branch3.id, "TRY", dateStr, [
          { itemId: item3?.id ?? item1.id, rawName: item3?.name ?? item1.name, qty: Math.floor(Math.random() * 100) + 20, price: 22, cost: 15 },
          { itemId: item4?.id ?? item1.id, rawName: item4?.name ?? item1.name, qty: Math.floor(Math.random() * 200) + 50, price: 14, cost: 8 },
        ]);
      }
    }
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
