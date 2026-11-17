import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActorIdentity,
  addBudgetItemWithAudit,
  addExpenseWithAudit,
  addShareholderWithAudit,
  addStockImportWithAudit,
  archiveProductWithAudit,
  authenticateUser,
  cancelOrder,
  changeUserPinWithAudit,
  computeBrandPnL,
  computeBudgetSummary,
  computeFundSummary,
  computeInventoryRows,
  computeTodayStats,
  confirmOrderPayment,
  createOrderWithValidation,
  createUserAccountWithAudit,
  deleteBudgetItemWithAudit,
  deleteExpenseWithAudit,
  deleteOrderWithAudit,
  deleteProductWithAudit,
  deleteShareholderWithAudit,
  deleteStockImportWithAudit,
  deleteUserAccountWithAudit,
  exportOrderRecipientsToCSV,
  exportOrdersToCSV,
  exportStateToJSON,
  exportViettelPostCSV,
  filterOrdersByShippingMethod,
  formatVND,
  getAvailableStock,
  getOrderCOD,
  getOrderTotal,
  getTodayISO,
  hasProductOrderHistory,
  markOrdersShippingStatus,
  parseImportedJSON,
  parseVNDInput,
  resetSystemDataWithAudit,
  restoreFromBackupWithAudit,
  saveProductWithAudit,
  saveProductWithValidation,
  suggestNextProductCode,
  toggleExpenseStatus,
  updateBudgetItemWithAudit,
  updateExpenseWithAudit,
  updateOrderShipping,
  updateOrderWithValidation,
  updateShareholderWithAudit,
  updateStockImportWithValidation,
  updateUserAccountWithAudit,
} from './finance';
import {
  buildFinanceWorkbook,
  buildOrderRecipientsWorkbook,
  buildOrdersWorkbook,
} from './excelExport';
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

test('authentication, account creation, PIN change, and RBAC deletion rules work accurately', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  assert.equal(seed.accounts.length, 5);

  const okLogin = authenticateUser(seed.accounts, 'giang', '2222');
  assert.equal(okLogin.ok, true);
  if (!okLogin.ok) return;
  assert.equal(okLogin.account.name, 'Giang');
  assert.equal(okLogin.account.role, 'Thành viên');

  const badLogin = authenticateUser(seed.accounts, 'Ngân', '9999');
  assert.equal(badLogin.ok, false);

  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };
  const giangActor: ActorIdentity = { id: 'acc_giang', name: 'Giang', role: 'Thành viên' };

  // Member cannot create account
  const memberCreate = createUserAccountWithAudit(
    seed,
    { name: 'Minh', username: 'minh', role: 'Thành viên', pin: '5678' },
    giangActor
  );
  assert.equal(memberCreate.ok, false);

  // Admin creates account
  const adminCreate = createUserAccountWithAudit(
    seed,
    { name: 'Minh', username: 'minh', role: 'Thành viên', pin: '5678' },
    nganActor
  );
  assert.equal(adminCreate.ok, true);
  if (!adminCreate.ok) return;
  assert.equal(adminCreate.state.accounts.length, 6);
  assert.ok(adminCreate.state.auditLogs[0].detail.includes('Ngân đã tạo tài khoản "Minh"'));

  // Giang changes own PIN
  const pinChanged = changeUserPinWithAudit(
    adminCreate.state,
    'acc_giang',
    '4321',
    giangActor,
    '2222'
  );
  assert.equal(pinChanged.ok, true);
  if (!pinChanged.ok) return;
  assert.equal(authenticateUser(pinChanged.state.accounts, 'Giang', '2222').ok, false);
  assert.equal(authenticateUser(pinChanged.state.accounts, 'Giang', '4321').ok, true);

  // RBAC: Giang cannot delete expense or shareholder permanently; Ngân can
  const blockedDeleteExp = deleteExpenseWithAudit(pinChanged.state, 'exp_01', giangActor);
  assert.equal(blockedDeleteExp.ok, false);
  const blockedDeleteSh = deleteShareholderWithAudit(pinChanged.state, 'sh_01', giangActor);
  assert.equal(blockedDeleteSh.ok, false);

  const allowedDeleteExp = deleteExpenseWithAudit(pinChanged.state, 'exp_01', nganActor);
  assert.equal(allowedDeleteExp.ok, true);
  if (!allowedDeleteExp.ok) return;
  assert.ok(allowedDeleteExp.state.auditLogs[0].detail.includes('xóa vĩnh viễn khoản chi'));
});

test('order creator, payment confirmation attribution, and finance/inventory edit audit diffs are recorded', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const giangActor: ActorIdentity = { id: 'acc_giang', name: 'Giang', role: 'Thành viên' };
  const phuongActor: ActorIdentity = { id: 'acc_phuong', name: 'Phương', role: 'Thành viên' };
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };

  // Giang creates order
  const created = createOrderWithValidation(
    seed,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Chị Lan',
      customerPhone: '0912345678',
      shippingAddress: '88 Phố Huế, Hai Bà Trưng, Hà Nội',
      shippingMethod: ShippingMethod.VIETTEL_POST,
      shopShippingCost: 30000,
      items: [{ productId: 'prd_tn_03', size: 'M', quantity: 1 }],
      shippingFee: 0,
      note: '',
      paymentStatus: PaymentStatus.UNPAID,
    },
    giangActor
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.order.createdBy, 'Giang');
  assert.ok(created.state.auditLogs[0].detail.includes('Giang đã tạo đơn hàng'));

  // Ngân confirms payment
  const paid = confirmOrderPayment(created.state, created.order.id, nganActor);
  const paidOrder = paid.orders.find((o) => o.id === created.order.id)!;
  assert.equal(paidOrder.paymentConfirmedBy, 'Ngân');
  assert.ok(paidOrder.paymentConfirmedAt);
  assert.ok(paid.auditLogs[0].detail.includes('Ngân đã xác nhận ĐÃ THANH TOÁN'));

  // Phương edits an expense and records old -> new diff
  const addedExp = addExpenseWithAudit(
    paid,
    {
      date: '2026-11-16',
      category: 'Sản xuất/Chụp ảnh',
      brandScope: 'Dùng chung',
      detail: 'Tiền studio',
      amount: 1200000,
      paidBy: 'Phương chi',
      receiptNote: '',
      status: ExpenseStatus.COMPLETED,
    },
    phuongActor
  );
  const studioExp = addedExp.expenses.find((e) => e.detail === 'Tiền studio')!;
  assert.equal(studioExp.enteredBy, 'Phương');

  const editedExp = updateExpenseWithAudit(
    addedExp,
    studioExp.id,
    { amount: 1413000 },
    phuongActor
  );
  assert.ok(
    editedExp.auditLogs[0].detail.includes('Phương đã sửa khoản chi') &&
      editedExp.auditLogs[0].detail.includes('1.200.000đ') &&
      editedExp.auditLogs[0].detail.includes('1.413.000đ')
  );

  // Edit shareholder & product price & stock import
  const editedSh = updateShareholderWithAudit(
    editedExp,
    'sh_02',
    { contribution: 7500000 },
    nganActor
  );
  assert.ok(editedSh.auditLogs[0].detail.includes('6.000.000đ') && editedSh.auditLogs[0].detail.includes('7.500.000đ'));

  const targetProduct = editedSh.products.find((p) => p.id === 'prd_tn_01')!;
  const editedProd = saveProductWithAudit(
    editedSh,
    { ...targetProduct, sellPrice: 1550000 },
    phuongActor
  );
  assert.ok(
    editedProd.auditLogs[0].detail.includes('giá bán từ 1.450.000đ thành 1.550.000đ')
  );

  const imported = addStockImportWithAudit(
    editedProd,
    {
      date: '2026-11-16',
      productId: 'prd_tn_01',
      size: 'M',
      quantity: 3,
      unitCost: 680000,
      note: 'Bổ sung',
    },
    false,
    giangActor
  );
  assert.equal(imported.stockImports[0].enteredBy, 'Giang');
  assert.ok(imported.auditLogs[0].detail.includes('Giang đã nhập kho +3 TN-01'));
});

test('parseImportedJSON migrates legacy JSON backups without accounts or auditLogs', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const legacyPayload = JSON.stringify({
    version: 2,
    data: {
      products: seed.products,
      stockImports: seed.stockImports,
      orders: seed.orders.map(({ createdBy: _cb, ...rest }) => rest),
      shareholders: seed.shareholders,
      expenses: seed.expenses,
      budgetItems: seed.budgetItems,
      isSampleData: true,
    },
  });
  const res = parseImportedJSON(legacyPayload);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.state.accounts.length, 5);
  assert.deepEqual(res.state.auditLogs, []);
  assert.equal(res.state.orders[0].createdBy, 'Hệ thống');
});

test('product lifecycle: auto-code suggestion, add, edit price/stock with historical preservation, and safe archive/delete RBAC', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };
  const giangActor: ActorIdentity = { id: 'acc_giang', name: 'Giang', role: 'Thành viên' };

  // 1. Auto-suggest codes
  assert.equal(suggestNextProductCode(Brand.TO_NHA, seed.products), 'TN-04');
  assert.equal(suggestNextProductCode(Brand.TO_VUONG, seed.products), 'TV-03');
  assert.equal(suggestNextProductCode(Brand.VAN_MIEN, seed.products), 'VM-03');

  // 2. Add new product with S, M, L stock
  const addRes = saveProductWithValidation(
    seed,
    {
      code: 'TN-04',
      name: 'Áo dài Lụa Sen Hồng',
      brand: Brand.TO_NHA,
      costPrice: 720000,
      sellPrice: 1580000,
      initialStock: { S: 2, M: 3, L: 1 },
    },
    giangActor
  );
  assert.equal(addRes.ok, true);
  if (!addRes.ok) return;
  assert.equal(addRes.product.code, 'TN-04');
  assert.equal(
    getAvailableStock(addRes.product.id, 'M', addRes.state.products, addRes.state.stockImports, addRes.state.orders),
    3
  );
  assert.equal(addRes.state.auditLogs[0].action, 'Thêm mẫu mới');

  // Duplicate code rejected
  const dupRes = saveProductWithValidation(
    addRes.state,
    {
      code: 'tn-04',
      name: 'Trùng mã',
      brand: Brand.TO_NHA,
      costPrice: 500000,
      sellPrice: 900000,
      initialStock: { S: 1 },
    },
    giangActor
  );
  assert.equal(dupRes.ok, false);

  // 3. Edit existing product (prd_tn_01) price & direct stock adjustment while preserving historical order ord_01
  const oldOrderBefore = addRes.state.orders.find((o) => o.id === 'ord_01')!;
  const oldOrderTotalBefore = getOrderTotal(oldOrderBefore);
  assert.equal(oldOrderBefore.items[0].productName, 'Áo dài Lụa Ngọc Bích');
  assert.equal(oldOrderBefore.items[0].unitPrice, 1450000);

  const stockBeforeM = getAvailableStock(
    'prd_tn_01',
    'M',
    addRes.state.products,
    addRes.state.stockImports,
    addRes.state.orders
  );
  assert.equal(stockBeforeM, 4);

  const editRes = saveProductWithValidation(
    addRes.state,
    {
      id: 'prd_tn_01',
      code: 'TN-01',
      name: 'Áo dài Lụa Ngọc Bích (Bản mới)',
      brand: Brand.TO_NHA,
      costPrice: 680000,
      sellPrice: 1690000,
      initialStock: { S: 2, M: 3, L: 2 },
      targetCurrentStock: { S: 2, M: 2, L: 2 },
      adjustmentReason: 'Kiểm kê thiếu 2 chiếc size M',
    },
    nganActor
  );
  assert.equal(editRes.ok, true);
  if (!editRes.ok) return;

  // Direct stock adjusted from 4 -> 2
  assert.equal(
    getAvailableStock('prd_tn_01', 'M', editRes.state.products, editRes.state.stockImports, editRes.state.orders),
    2
  );
  // Audit logs record both stock adjustment and product update
  assert.equal(editRes.state.auditLogs[0].action, 'Điều chỉnh tồn kho');
  assert.ok(editRes.state.auditLogs[0].detail.includes('Size M: 4 → 2 (-2)'));
  assert.equal(editRes.state.auditLogs[1].action, 'Sửa mẫu sản phẩm');

  // Historical order ord_01 MUST NOT change name or price
  const oldOrderAfter = editRes.state.orders.find((o) => o.id === 'ord_01')!;
  assert.equal(oldOrderAfter.items[0].productName, 'Áo dài Lụa Ngọc Bích');
  assert.equal(oldOrderAfter.items[0].unitPrice, 1450000);
  assert.equal(getOrderTotal(oldOrderAfter), oldOrderTotalBefore);

  // 4. Safe archive / delete RBAC & historical order check
  const hist = hasProductOrderHistory('prd_tn_01', editRes.state.orders);
  assert.equal(hist.hasOrders, true);

  // Member Giang cannot archive or delete
  assert.equal(archiveProductWithAudit(editRes.state, 'prd_tn_01', true, giangActor).ok, false);
  assert.equal(deleteProductWithAudit(editRes.state, 'prd_tn_01', giangActor).ok, false);

  // Admin Ngân archives prd_tn_01
  const archivedRes = archiveProductWithAudit(editRes.state, 'prd_tn_01', true, nganActor);
  assert.equal(archivedRes.ok, true);
  if (!archivedRes.ok) return;
  assert.equal(archivedRes.state.auditLogs[0].action, 'Ngừng kinh doanh mẫu');

  // Creating a new order with an archived product fails
  const blockedOrder = createOrderWithValidation(
    archivedRes.state,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Khách thử',
      customerPhone: '0909000111',
      shippingAddress: '10 Tràng Tiền, Hà Nội',
      shippingMethod: ShippingMethod.PICKUP,
      shopShippingCost: 0,
      items: [{ productId: 'prd_tn_01', size: 'M', quantity: 1 }],
      shippingFee: 0,
      note: '',
      paymentStatus: PaymentStatus.UNPAID,
    },
    nganActor
  );
  assert.equal(blockedOrder.ok, false);

  // Admin deletes TN-04 cleanly
  const deletedRes = deleteProductWithAudit(archivedRes.state, addRes.product.id, nganActor);
  assert.equal(deletedRes.ok, true);
  if (!deletedRes.ok) return;
  assert.equal(deletedRes.state.products.some((p) => p.id === addRes.product.id), false);
  assert.equal(deletedRes.state.auditLogs[0].action, 'Xóa mẫu sản phẩm');
});

test('full order edit & delete recalculate inventory, revenue, and linked shipping expenses', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };

  // ord_02 initially has VM-02 (Freesize) x1 and VM-01 (Freesize) x2, shopShippingCost 35000
  const vm01Before = getAvailableStock('prd_vm_01', 'Freesize', seed.products, seed.stockImports, seed.orders);
  const vm02Before = getAvailableStock('prd_vm_02', 'Freesize', seed.products, seed.stockImports, seed.orders);
  assert.equal(vm01Before, 8);
  assert.equal(vm02Before, 1);

  // Edit ord_02: change items to VM-01 x3 (drops VM-02, restores VM-02 +1 -> 2, deducts VM-01 net +1 -> 7), change shopShippingCost 35000 -> 45000, mark PAID
  const editRes = updateOrderWithValidation(
    seed,
    'ord_02',
    {
      date: seed.orders.find((o) => o.id === 'ord_02')!.date,
      brand: Brand.VAN_MIEN,
      customerName: 'Trần Hoàng Bảo (Sửa)',
      customerPhone: '0987612409',
      shippingAddress: 'Số 50 Lý Thường Kiệt, Hà Nội',
      shippingMethod: ShippingMethod.VIETTEL_POST,
      shopShippingCost: 45000,
      shippingCostPayer: 'Giang chi',
      shippingStatus: ShippingStatus.VTP_CREATED,
      weightGrams: 1200,
      items: [{ productId: 'prd_vm_01', size: 'Freesize', quantity: 3, unitPrice: 480000 }],
      shippingFee: 0,
      note: 'Đã sửa đơn',
      paymentStatus: PaymentStatus.PAID,
    },
    nganActor
  );
  assert.equal(editRes.ok, true);
  if (!editRes.ok) return;

  assert.equal(
    getAvailableStock('prd_vm_02', 'Freesize', editRes.state.products, editRes.state.stockImports, editRes.state.orders),
    2
  );
  assert.equal(
    getAvailableStock('prd_vm_01', 'Freesize', editRes.state.products, editRes.state.stockImports, editRes.state.orders),
    7
  );
  const linkedShipExp = editRes.state.expenses.find((e) => e.linkedOrderId === 'ord_02');
  assert.ok(linkedShipExp);
  assert.equal(linkedShipExp.amount, 45000);
  assert.equal(linkedShipExp.paidBy, 'Giang chi');
  assert.equal(editRes.order.paymentStatus, PaymentStatus.PAID);

  // Delete ord_02: restores VM-01 +3 -> 10, removes linked shipping expense, subtracts revenue
  const salesBeforeDelete = computeBrandPnL(
    editRes.state.products,
    editRes.state.stockImports,
    editRes.state.orders,
    editRes.state.expenses
  ).total.salesRevenue;

  const afterDelete = deleteOrderWithAudit(editRes.state, 'ord_02', nganActor);
  assert.equal(afterDelete.orders.some((o) => o.id === 'ord_02'), false);
  assert.equal(afterDelete.expenses.some((e) => e.linkedOrderId === 'ord_02'), false);
  assert.equal(
    getAvailableStock('prd_vm_01', 'Freesize', afterDelete.products, afterDelete.stockImports, afterDelete.orders),
    10
  );
  const salesAfterDelete = computeBrandPnL(
    afterDelete.products,
    afterDelete.stockImports,
    afterDelete.orders,
    afterDelete.expenses
  ).total.salesRevenue;
  assert.equal(salesAfterDelete, salesBeforeDelete - 3 * 480000);
});

test('stock import edit/delete, budget CRUD, and user account edit/delete behave cleanly', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };

  // Add stock import with linked cash expense, then edit and delete it
  const impAdded = addStockImportWithAudit(
    seed,
    {
      date: '2026-11-16',
      productId: 'prd_tn_03',
      size: 'M',
      quantity: 5,
      unitCost: 700000,
      note: 'Lô test',
    },
    true,
    nganActor
  );
  const newImp = impAdded.stockImports[0];
  assert.equal(
    getAvailableStock('prd_tn_03', 'M', impAdded.products, impAdded.stockImports, impAdded.orders),
    8
  );
  assert.equal(impAdded.expenses.some((e) => e.linkedImportId === newImp.id && e.amount === 3500000), true);

  const impEdited = updateStockImportWithValidation(
    impAdded,
    newImp.id,
    {
      date: '2026-11-16',
      productId: 'prd_tn_03',
      size: 'M',
      quantity: 2,
      unitCost: 650000,
      note: 'Sửa SL',
    },
    nganActor
  );
  assert.equal(impEdited.ok, true);
  if (!impEdited.ok) return;
  assert.equal(
    getAvailableStock('prd_tn_03', 'M', impEdited.state.products, impEdited.state.stockImports, impEdited.state.orders),
    5
  );
  assert.equal(
    impEdited.state.expenses.find((e) => e.linkedImportId === newImp.id)?.amount,
    1300000
  );

  const impDeleted = deleteStockImportWithAudit(impEdited.state, newImp.id, nganActor);
  assert.equal(
    getAvailableStock('prd_tn_03', 'M', impDeleted.products, impDeleted.stockImports, impDeleted.orders),
    3
  );
  assert.equal(impDeleted.expenses.some((e) => e.linkedImportId === newImp.id), false);

  // Budget CRUD
  const bdgAdded = addBudgetItemWithAudit(
    impDeleted,
    { category: 'Marketing/Ads', detail: 'TikTok Ads', quantity: 2, estimatedUnitPrice: 1000000 },
    nganActor
  );
  const createdBdg = bdgAdded.budgetItems[bdgAdded.budgetItems.length - 1];
  const bdgUpdated = updateBudgetItemWithAudit(
    bdgAdded,
    createdBdg.id,
    { category: 'Marketing/Ads', detail: 'TikTok Ads Q4', quantity: 3, estimatedUnitPrice: 1200000 },
    nganActor
  );
  assert.equal(
    bdgUpdated.budgetItems.find((b) => b.id === createdBdg.id)?.estimatedUnitPrice,
    1200000
  );
  const bdgDeleted = deleteBudgetItemWithAudit(bdgUpdated, createdBdg.id, nganActor);
  assert.equal(bdgDeleted.budgetItems.some((b) => b.id === createdBdg.id), false);

  // User account edit & delete
  const accEdited = updateUserAccountWithAudit(
    bdgDeleted,
    'acc_linh',
    { name: 'Linh Nhi', username: 'linhnhi', role: 'Thành viên' },
    nganActor
  );
  assert.equal(accEdited.ok, true);
  if (!accEdited.ok) return;
  assert.equal(accEdited.state.accounts.find((a) => a.id === 'acc_linh')?.name, 'Linh Nhi');

  // Cannot delete self
  assert.equal(deleteUserAccountWithAudit(accEdited.state, 'acc_ngan', nganActor).ok, false);
  const accDeleted = deleteUserAccountWithAudit(accEdited.state, 'acc_linh', nganActor);
  assert.equal(accDeleted.ok, true);
  if (!accDeleted.ok) return;
  assert.equal(accDeleted.state.accounts.some((a) => a.id === 'acc_linh'), false);
});

test('SheetJS Excel (.xlsx) builders generate valid orders workbook and 3-sheet finance report', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));

  const ordersWb = buildOrdersWorkbook(seed.orders);
  assert.deepEqual(ordersWb.SheetNames, ['Danh_sach_don_hang']);
  const ordersWs = ordersWb.Sheets['Danh_sach_don_hang'];
  assert.equal(ordersWs['A1'].v, 'Mã đơn');
  assert.equal(ordersWs['J1'].v, 'Giảm giá');
  assert.equal(ordersWs['R1'].v, 'Ghi chú');
  assert.equal(ordersWs['A2'].v, 'DH-0001');
  assert.equal(typeof ordersWs['I2'].v, 'number');

  const financeWb = buildFinanceWorkbook(seed);
  assert.deepEqual(financeWb.SheetNames, [
    'Tong_hop_P&L',
    'Doanh_thu_Don_hang',
    'Chi_tiet_Khoan_chi',
  ]);
  assert.equal(financeWb.Sheets['Tong_hop_P&L']['A1'].v, 'BÁO CÁO TỔNG HỢP TÀI CHÍNH & LÃI LỖ (P&L)');
  assert.equal(financeWb.Sheets['Doanh_thu_Don_hang']['A1'].v, 'Mã đơn');
  assert.equal(financeWb.Sheets['Chi_tiet_Khoan_chi']['A1'].v, 'Ngày chi');
});

test('parseVNDInput handles plain, dotted, comma-formatted, and invalid currency strings; addShareholderWithAudit updates Cash Fund', () => {
  assert.equal(parseVNDInput('6000000'), 6000000);
  assert.equal(parseVNDInput('6.000.000'), 6000000);
  assert.equal(parseVNDInput('5,500,000 đ'), 5500000);
  assert.equal(parseVNDInput('12500'), 12500);
  assert.equal(parseVNDInput('0'), 0);
  assert.equal(Number.isNaN(parseVNDInput('')), true);
  assert.equal(Number.isNaN(parseVNDInput('abc')), true);
  assert.equal(parseVNDInput('-5000'), -1);

  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const beforeFund = computeFundSummary(seed.shareholders, seed.expenses);
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };

  const afterAdd = addShareholderWithAudit(
    seed,
    { name: 'Minh Anh', contribution: parseVNDInput('6.000.000'), note: 'Góp thêm' },
    nganActor
  );
  const afterFund = computeFundSummary(afterAdd.shareholders, afterAdd.expenses);
  assert.equal(afterFund.totalCapital, beforeFund.totalCapital + 6000000);
  assert.equal(afterFund.currentBalance, beforeFund.currentBalance + 6000000);
  assert.equal(afterAdd.shareholders[afterAdd.shareholders.length - 1].name, 'Minh Anh');
});

test('order optional discount deducts from total, COD, P&L, and rejects negative or excessive discounts', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };

  // 1. Order WITHOUT discount (omitted / 0) works cleanly
  const noDiscountRes = createOrderWithValidation(
    seed,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Khách không KM',
      customerPhone: '0901000222',
      shippingAddress: '12 Tràng Thi, Hà Nội',
      shippingMethod: ShippingMethod.PICKUP,
      shopShippingCost: 0,
      items: [{ productId: 'prd_tn_01', size: 'M', quantity: 2 }],
      shippingFee: 0,
      note: '',
      paymentStatus: PaymentStatus.UNPAID,
    },
    nganActor
  );
  assert.equal(noDiscountRes.ok, true);
  if (!noDiscountRes.ok) return;
  assert.equal(noDiscountRes.order.discount, undefined);
  assert.equal(getOrderTotal(noDiscountRes.order), 2 * 1450000);
  assert.equal(getOrderCOD(noDiscountRes.order), 2900000);

  // 2. Negative discount rejected
  const negDiscount = createOrderWithValidation(
    seed,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Khách lỗi',
      customerPhone: '0901000333',
      shippingAddress: '12 Tràng Thi, Hà Nội',
      shippingMethod: ShippingMethod.PICKUP,
      shopShippingCost: 0,
      items: [{ productId: 'prd_tn_01', size: 'M', quantity: 1 }],
      shippingFee: 0,
      discount: -50000,
      note: '',
      paymentStatus: PaymentStatus.UNPAID,
    },
    nganActor
  );
  assert.equal(negDiscount.ok, false);

  // 3. Discount exceeding subtotal + shippingFee rejected
  const overDiscount = createOrderWithValidation(
    seed,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Khách lỗi 2',
      customerPhone: '0901000444',
      shippingAddress: '12 Tràng Thi, Hà Nội',
      shippingMethod: ShippingMethod.PICKUP,
      shopShippingCost: 0,
      items: [{ productId: 'prd_tn_01', size: 'M', quantity: 1 }],
      shippingFee: 0,
      discount: 2000000,
      note: '',
      paymentStatus: PaymentStatus.UNPAID,
    },
    nganActor
  );
  assert.equal(overDiscount.ok, false);

  // 4. Order WITH promotional discount = 200,000 on 2 * 1,450,000 = 2,700,000
  const basePnL = computeBrandPnL(
    seed.products,
    seed.stockImports,
    seed.orders,
    seed.expenses
  ).total.salesRevenue;

  const withDiscountRes = createOrderWithValidation(
    seed,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Khách KM 200k',
      customerPhone: '0901000555',
      shippingAddress: '18 Lý Thái Tổ, Hà Nội',
      shippingMethod: ShippingMethod.VIETTEL_POST,
      shopShippingCost: 30000,
      items: [{ productId: 'prd_tn_01', size: 'M', quantity: 2 }],
      shippingFee: 0,
      discount: 200000,
      note: 'KM khai trương',
      paymentStatus: PaymentStatus.UNPAID,
    },
    nganActor
  );
  assert.equal(withDiscountRes.ok, true);
  if (!withDiscountRes.ok) return;
  assert.equal(withDiscountRes.order.discount, 200000);
  assert.equal(getOrderTotal(withDiscountRes.order), 2700000);
  assert.equal(getOrderCOD(withDiscountRes.order), 2700000);

  const afterPnL = computeBrandPnL(
    withDiscountRes.state.products,
    withDiscountRes.state.stockImports,
    withDiscountRes.state.orders,
    withDiscountRes.state.expenses
  ).total.salesRevenue;
  assert.equal(afterPnL, basePnL + 2700000);

  // 5. Editing discount updates total, COD, and clearing discount resets to 0
  const editedDiscount = updateOrderWithValidation(
    withDiscountRes.state,
    withDiscountRes.order.id,
    {
      date: '2026-11-16',
      brand: Brand.TO_NHA,
      customerName: 'Khách KM 200k',
      customerPhone: '0901000555',
      shippingAddress: '18 Lý Thái Tổ, Hà Nội',
      shippingMethod: ShippingMethod.VIETTEL_POST,
      shopShippingCost: 30000,
      items: [{ productId: 'prd_tn_01', size: 'M', quantity: 2, unitPrice: 1450000 }],
      shippingFee: 0,
      discount: 0,
      note: '',
      paymentStatus: PaymentStatus.UNPAID,
    },
    nganActor
  );
  assert.equal(editedDiscount.ok, true);
  if (!editedDiscount.ok) return;
  assert.equal(editedDiscount.order.discount, 0);
  assert.equal(getOrderTotal(editedDiscount.order), 2900000);

  // 6. Excel & CSV include discount
  const wb = buildOrdersWorkbook([withDiscountRes.order]);
  const ws = wb.Sheets['Danh_sach_don_hang'];
  assert.equal(ws['J2'].v, 200000);
  assert.equal(ws['K2'].v, 2700000);
});

test('recipient export filters by shipping method (all vs individual) and outputs Name, Phone, Address', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));

  // Seed has 4 active orders:
  // ord_01: PICKUP (Khách tự lấy)
  // ord_02: LOCAL_SHIP (Ship nội thành)
  // ord_03: VIETTEL_POST (Viettel Post)
  // ord_04: VIETTEL_POST (Viettel Post)
  const allActive = filterOrdersByShippingMethod(seed.orders, 'all');
  assert.equal(allActive.length, 4);

  const vtpOnly = filterOrdersByShippingMethod(seed.orders, ShippingMethod.VIETTEL_POST);
  assert.equal(vtpOnly.length, 2);
  assert.ok(vtpOnly.every((o) => o.shippingMethod === ShippingMethod.VIETTEL_POST));

  const localOnly = filterOrdersByShippingMethod(seed.orders, ShippingMethod.LOCAL_SHIP);
  assert.equal(localOnly.length, 1);
  assert.equal(localOnly[0].id, 'ord_02');

  const pickupOnly = filterOrdersByShippingMethod(seed.orders, ShippingMethod.PICKUP);
  assert.equal(pickupOnly.length, 1);
  assert.equal(pickupOnly[0].id, 'ord_01');

  // Cancelled orders are excluded by default
  const afterCancel = cancelOrder(seed, 'ord_02');
  assert.equal(filterOrdersByShippingMethod(afterCancel.orders, 'all').length, 3);
  assert.equal(
    filterOrdersByShippingMethod(afterCancel.orders, ShippingMethod.LOCAL_SHIP).length,
    0
  );
  assert.equal(
    filterOrdersByShippingMethod(afterCancel.orders, ShippingMethod.LOCAL_SHIP, {
      includeCancelled: true,
    }).length,
    1
  );

  // CSV recipient export contains UTF-8 BOM and strictly 3 columns: Tên người nhận, Số điện thoại, Địa chỉ
  const csvAll = exportOrderRecipientsToCSV(seed.orders, 'all');
  assert.ok(csvAll.startsWith('\uFEFF'));
  const csvAllLines = csvAll.replace(/^\uFEFF/, '').split('\n');
  assert.equal(csvAllLines[0], 'Tên người nhận,Số điện thoại,Địa chỉ');
  assert.equal(csvAllLines.length, 5); // header + 4 orders

  const csvLocal = exportOrderRecipientsToCSV(seed.orders, ShippingMethod.LOCAL_SHIP);
  const csvLocalLines = csvLocal.replace(/^\uFEFF/, '').split('\n');
  assert.equal(csvLocalLines.length, 2);
  assert.ok(csvLocalLines[1].includes('Trần Hoàng Bảo'));
  assert.ok(csvLocalLines[1].includes('0987612409'));

  // Excel recipient workbook builds clean 3-column sheet preserving leading zero in phone
  const wbVtp = buildOrderRecipientsWorkbook(seed.orders, ShippingMethod.VIETTEL_POST);
  assert.deepEqual(wbVtp.SheetNames, ['Danh_sach_nguoi_nhan']);
  const wsVtp = wbVtp.Sheets['Danh_sach_nguoi_nhan'];
  assert.equal(wsVtp['A1'].v, 'Tên người nhận');
  assert.equal(wsVtp['B1'].v, 'Số điện thoại');
  assert.equal(wsVtp['C1'].v, 'Địa chỉ');
  assert.equal(wsVtp['D1'], undefined);
  assert.equal(wsVtp['B2'].t, 's');
  assert.ok(String(wsVtp['B2'].v).startsWith('0'));
  assert.equal(wsVtp['A4'], undefined); // only header + 2 VTP rows
});

test('every delete and reset automatically creates pre-delete backup snapshot and supports 1-click restore', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const nganActor: ActorIdentity = { id: 'acc_ngan', name: 'Ngân', role: 'Admin' };
  const giangActor: ActorIdentity = { id: 'acc_giang', name: 'Giang', role: 'Thành viên' };

  // 1. Delete an order -> pre-delete backup captures the deleted order + linked expense
  const afterDelOrder = deleteOrderWithAudit(seed, 'ord_02', giangActor);
  assert.equal(afterDelOrder.orders.some((o) => o.id === 'ord_02'), false);
  assert.equal(afterDelOrder.backups.length, 1);
  const orderBackup = afterDelOrder.backups[0];
  assert.equal(orderBackup.actorName, 'Giang');
  assert.equal(orderBackup.summary.ordersCount, seed.orders.length);
  assert.ok(orderBackup.snapshot.orders.some((o) => o.id === 'ord_02'));
  assert.ok(orderBackup.snapshot.expenses.some((e) => e.linkedOrderId === 'ord_02'));

  // 2. Delete product, stock import, shareholder, expense, budget, user account -> each appends a backup
  const afterDelProdRes = deleteProductWithAudit(afterDelOrder, 'prd_tn_03', nganActor);
  assert.equal(afterDelProdRes.ok, true);
  if (!afterDelProdRes.ok) return;
  assert.equal(afterDelProdRes.state.backups.length, 2);

  const afterDelImp = deleteStockImportWithAudit(afterDelProdRes.state, 'imp_01', nganActor);
  assert.equal(afterDelImp.backups.length, 3);

  const afterDelShRes = deleteShareholderWithAudit(afterDelImp, 'sh_04', nganActor);
  assert.equal(afterDelShRes.ok, true);
  if (!afterDelShRes.ok) return;
  assert.equal(afterDelShRes.state.backups.length, 4);

  const afterDelExpRes = deleteExpenseWithAudit(afterDelShRes.state, 'exp_01', nganActor);
  assert.equal(afterDelExpRes.ok, true);
  if (!afterDelExpRes.ok) return;
  assert.equal(afterDelExpRes.state.backups.length, 5);

  const afterDelBdg = deleteBudgetItemWithAudit(afterDelExpRes.state, 'bdg_01', nganActor);
  assert.equal(afterDelBdg.backups.length, 6);

  const afterDelAccRes = deleteUserAccountWithAudit(afterDelBdg, 'acc_linh', nganActor);
  assert.equal(afterDelAccRes.ok, true);
  if (!afterDelAccRes.ok) return;
  assert.equal(afterDelAccRes.state.backups.length, 7);

  // 3. Reset system to 0 -> saves backup of state before reset, clears business data, keeps accounts & backups
  const resetRes = resetSystemDataWithAudit(afterDelAccRes.state, nganActor);
  assert.equal(resetRes.ok, true);
  if (!resetRes.ok) return;
  assert.equal(resetRes.state.orders.length, 0);
  assert.equal(resetRes.state.products.length, 0);
  assert.equal(resetRes.state.expenses.length, 0);
  assert.equal(resetRes.state.shareholders.length, 0);
  assert.equal(resetRes.state.backups.length, 8);

  // 4. Restore from the very first pre-delete backup (orderBackup) -> brings back ALL original orders, products, expenses, shareholders, accounts!
  const restoreRes = restoreFromBackupWithAudit(resetRes.state, orderBackup.id, nganActor);
  assert.equal(restoreRes.ok, true);
  if (!restoreRes.ok) return;
  assert.equal(restoreRes.state.orders.length, seed.orders.length);
  assert.ok(restoreRes.state.orders.some((o) => o.id === 'ord_02'));
  assert.equal(restoreRes.state.products.length, seed.products.length);
  assert.equal(restoreRes.state.shareholders.length, seed.shareholders.length);
  assert.equal(restoreRes.state.expenses.length, seed.expenses.length);
  assert.equal(restoreRes.state.accounts.length, seed.accounts.length);
  assert.equal(restoreRes.state.backups.length, 9); // safety backup before restore also saved
  assert.equal(restoreRes.state.auditLogs[0].action, 'Khôi phục bản sao lưu');

  // 5. Non-admin restoring business data restores orders/products while keeping current accounts intact
  const nonAdminRestore = restoreFromBackupWithAudit(resetRes.state, orderBackup.id, giangActor);
  assert.equal(nonAdminRestore.ok, true);
  if (!nonAdminRestore.ok) return;
  assert.equal(nonAdminRestore.state.orders.length, seed.orders.length);
  assert.equal(nonAdminRestore.state.accounts.length, resetRes.state.accounts.length);
});

