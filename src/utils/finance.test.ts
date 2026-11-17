import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelOrder,
  computeBrandPnL,
  computeBudgetSummary,
  computeFundSummary,
  computeInventoryRows,
  computeTodayStats,
  confirmOrderPayment,
  createOrderWithValidation,
  exportOrdersToCSV,
  exportStateToJSON,
  exportViettelPostCSV,
  formatVND,
  getAvailableStock,
  getOrderCOD,
  getTodayISO,
  markOrdersShippingStatus,
  parseImportedJSON,
  toggleExpenseStatus,
  updateOrderShipping,
} from './finance';
import { createSeedState } from '../data/seedData';
import {
  Brand,
  ExpenseStatus,
  PaymentStatus,
  ShippingMethod,
  ShippingStatus,
} from '../types/erp';

test('formatVND formats Vietnamese currency and negative parentheses accurately', () => {
  assert.equal(formatVND(1500000), '1.500.000 đ');
  assert.equal(formatVND(0), '0 đ');
  assert.equal(formatVND(-500000), '-500.000 đ');
  assert.equal(formatVND(-500000, { parenthesesForNegative: true }), '(500.000 đ)');
});

test('inventory calculation tracks initial + imported - sold and flags low stock <= 1', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const rows = computeInventoryRows(seed.products, seed.stockImports, seed.orders);

  const tn01M = rows.find((r) => r.productCode === 'TN-01' && r.size === 'M');
  assert.ok(tn01M);
  assert.equal(tn01M.initialStock, 3);
  assert.equal(tn01M.totalImported, 2);
  assert.equal(tn01M.totalSold, 1);
  assert.equal(tn01M.currentStock, 4);
  assert.equal(tn01M.isLowStock, false);

  const tn02S = rows.find((r) => r.productCode === 'TN-02' && r.size === 'S');
  assert.ok(tn02S);
  assert.equal(tn02S.currentStock, 0);
  assert.equal(tn02S.isLowStock, true);

  const vm02 = rows.find((r) => r.productCode === 'VM-02' && r.size === 'Freesize');
  assert.ok(vm02);
  assert.equal(vm02.currentStock, 1);
  assert.equal(vm02.isLowStock, true);
});

test('creating, confirming, and cancelling an order deducts/restores stock and syncs shipping expense', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const beforeStock = getAvailableStock('prd_tn_01', 'M', seed.products, seed.stockImports, seed.orders);
  assert.equal(beforeStock, 4);
  const initialFund = computeFundSummary(seed.shareholders, seed.expenses);

  // Missing address -> fails validation
  const missingAddr = createOrderWithValidation(seed, {
    date: '2026-11-16',
    brand: Brand.TO_NHA,
    customerName: 'Lan Anh',
    customerPhone: '0901112223',
    shippingAddress: '',
    shippingMethod: ShippingMethod.VIETTEL_POST,
    shopShippingCost: 30000,
    items: [{ productId: 'prd_tn_01', size: 'M', quantity: 1 }],
    shippingFee: 0,
    note: '',
    paymentStatus: PaymentStatus.UNPAID,
  });
  assert.equal(missingAddr.ok, false);

  // Valid order with shopShippingCost = 32,000
  const okRes = createOrderWithValidation(seed, {
    date: '2026-11-16',
    brand: Brand.TO_NHA,
    customerName: 'Lan Anh',
    customerPhone: '0901112223',
    shippingAddress: '15 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
    shippingMethod: ShippingMethod.VIETTEL_POST,
    shopShippingCost: 32000,
    shippingCostPayer: 'Giang chi',
    weightGrams: 500,
    items: [{ productId: 'prd_tn_01', size: 'M', quantity: 2 }],
    shippingFee: 30000,
    note: 'Giao giờ hành chính',
    paymentStatus: PaymentStatus.UNPAID,
  });
  assert.equal(okRes.ok, true);
  if (!okRes.ok) return;

  assert.equal(
    getAvailableStock('prd_tn_01', 'M', okRes.state.products, okRes.state.stockImports, okRes.state.orders),
    2
  );

  // Linked shipping expense created and fund reduced by 32,000
  const linkedExp = okRes.state.expenses.find((e) => e.linkedOrderId === okRes.order.id);
  assert.ok(linkedExp);
  assert.equal(linkedExp.category, 'Vận chuyển');
  assert.equal(linkedExp.amount, 32000);
  assert.equal(linkedExp.paidBy, 'Giang chi');
  assert.equal(linkedExp.status, ExpenseStatus.COMPLETED);
  assert.equal(linkedExp.detail, 'Viettel Post - Đơn của Lan Anh (0901112223)');

  const fundAfterCreate = computeFundSummary(okRes.state.shareholders, okRes.state.expenses);
  assert.equal(fundAfterCreate.currentBalance, initialFund.currentBalance - 32000);

  // COD before payment = 2 * 1,450,000 + 30,000 = 2,930,000
  assert.equal(getOrderCOD(okRes.order), 2930000);

  // Update shipping cost from 32,000 -> 45,000 -> linked expense updates without duplication
  const updatedShipping = updateOrderShipping(okRes.state, okRes.order.id, {
    shopShippingCost: 45000,
    weightGrams: 650,
  });
  const matchingExps = updatedShipping.expenses.filter((e) => e.linkedOrderId === okRes.order.id);
  assert.equal(matchingExps.length, 1);
  assert.equal(matchingExps[0].amount, 45000);

  // Update shipping cost to 0 -> linked expense removed
  const zeroShipping = updateOrderShipping(updatedShipping, okRes.order.id, {
    shopShippingCost: 0,
  });
  assert.equal(
    zeroShipping.expenses.filter((e) => e.linkedOrderId === okRes.order.id).length,
    0
  );

  // Restore 35,000 shipping cost, confirm payment (COD becomes 0), then cancel order -> stock & fund restored
  const restoredShipping = updateOrderShipping(zeroShipping, okRes.order.id, {
    shopShippingCost: 35000,
  });
  const paidState = confirmOrderPayment(restoredShipping, okRes.order.id);
  const confirmed = paidState.orders.find((o) => o.id === okRes.order.id)!;
  assert.equal(confirmed.paymentStatus, PaymentStatus.PAID);
  assert.equal(getOrderCOD(confirmed), 0);

  const cancelledState = cancelOrder(paidState, okRes.order.id);
  assert.equal(
    getAvailableStock(
      'prd_tn_01',
      'M',
      cancelledState.products,
      cancelledState.stockImports,
      cancelledState.orders
    ),
    4
  );
  assert.equal(
    cancelledState.expenses.filter((e) => e.linkedOrderId === okRes.order.id).length,
    0
  );
  const fundAfterCancel = computeFundSummary(cancelledState.shareholders, cancelledState.expenses);
  assert.equal(fundAfterCancel.currentBalance, initialFund.currentBalance);
});

test('today stats separate paid vs unpaid revenue and exclude cancelled orders', () => {
  const baseDate = new Date('2026-11-16T10:00:00');
  const today = getTodayISO(baseDate);
  const seed = createSeedState(baseDate);

  const stats = computeTodayStats(seed.orders, today);
  assert.equal(stats.orderCount, 2);
  assert.equal(stats.paidRevenue, 1450000);
  assert.equal(stats.unpaidRevenue, 1885000);
  assert.equal(stats.totalRevenue, 3335000);

  const afterCancel = cancelOrder(seed, 'ord_02');
  const statsAfter = computeTodayStats(afterCancel.orders, today);
  assert.equal(statsAfter.orderCount, 1);
  assert.equal(statsAfter.paidRevenue, 1450000);
  assert.equal(statsAfter.unpaidRevenue, 0);
});

test('P&L, Cash Fund (including shipping expenses), Expense toggle, and Budget Gap reconcile cleanly', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));

  const pnl = computeBrandPnL(seed.products, seed.stockImports, seed.orders, seed.expenses);
  const sumBrandProfit = pnl.byBrand.reduce((s, r) => s + r.profit, 0);
  assert.equal(sumBrandProfit, pnl.total.profit);
  assert.equal(
    pnl.total.profit,
    pnl.total.salesRevenue - pnl.total.importCost - pnl.total.operatingExpense
  );

  // Total spent includes 9,600,000 + 35,000 + 32,000 + 28,000 = 9,695,000
  const fund = computeFundSummary(seed.shareholders, seed.expenses);
  assert.equal(fund.totalCapital, 30000000);
  assert.equal(fund.totalSpent, 9695000);
  assert.equal(fund.currentBalance, 20305000);

  const toggled = toggleExpenseStatus(seed, 'exp_04');
  assert.equal(toggled.expenses.find((e) => e.id === 'exp_04')?.status, ExpenseStatus.COMPLETED);

  const budget = computeBudgetSummary(seed.budgetItems, fund.currentBalance);
  assert.equal(budget.totalBudget, 22700000);
  assert.equal(budget.balanceDifference, 20305000 - 22700000);
});

test('Viettel Post CSV export formats 9 columns with UTF-8 BOM and batch status update', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const vtpOrders = seed.orders.filter(
    (o) => !o.isCancelled && o.shippingMethod === ShippingMethod.VIETTEL_POST
  );
  assert.equal(vtpOrders.length, 2); // ord_03 (unpaid), ord_04 (paid)

  const vtpCsv = exportViettelPostCSV(vtpOrders);
  assert.ok(vtpCsv.startsWith('\uFEFF'));
  assert.ok(vtpCsv.includes('Mã đơn hàng,Tên người nhận,Số điện thoại người nhận'));
  assert.ok(vtpCsv.includes('DH0003,Lê Quang Hải,0904551228'));
  assert.ok(vtpCsv.includes('1x Áo dài Nam Gấm Nhật Bình (L),500,1630000,VCN - Chuyển phát nhanh'));
  // Paid order ord_04 has COD = 0
  assert.ok(vtpCsv.includes('1x Áo dài Gấm Liên Hoa (S),500,0,VCN - Chuyển phát nhanh'));
  assert.ok(vtpCsv.includes('Cho xem hàng, không cho thử'));

  const marked = markOrdersShippingStatus(
    seed,
    vtpOrders.map((o) => o.id),
    ShippingStatus.VTP_CREATED
  );
  assert.equal(
    marked.orders.find((o) => o.id === 'ord_03')?.shippingStatus,
    ShippingStatus.VTP_CREATED
  );
  assert.equal(
    marked.orders.find((o) => o.id === 'ord_04')?.shippingStatus,
    ShippingStatus.VTP_CREATED
  );

  // General JSON & CSV round-trip
  const json = exportStateToJSON(seed);
  const parsed = parseImportedJSON(json);
  assert.equal(parsed.ok, true);
  const csv = exportOrdersToCSV(seed.orders);
  assert.ok(csv.includes('DH-0001'));
});
