import * as XLSX from 'xlsx';
import { AppState, BRAND_SUBTITLES, Order } from '../types/erp';
import {
  computeBrandPnL,
  computeFundSummary,
  filterOrdersByShippingMethod,
  formatDateVN,
  getOrderCOD,
  getOrderItemsSubtotal,
  getOrderTotal,
  getShippingMethodSlug,
  getTodayISO,
  ShippingExportFilter,
} from './finance';

function formatFilenameDate(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}_${m}_${y}`;
}

function autoFitColumns(ws: XLSX.WorkSheet, rows: Array<Array<string | number | null | undefined>>, minWidth = 10, maxWidth = 52) {
  const colWidths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, idx) => {
      const len = String(cell ?? '').length;
      const current = colWidths[idx] ?? minWidth;
      if (len + 3 > current) {
        colWidths[idx] = Math.min(maxWidth, len + 3);
      }
    });
  }
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
}

function applyNumberFormat(ws: XLSX.WorkSheet, colIndices: number[], startRow: number, endRow: number, fmt = '#,##0') {
  for (let r = startRow; r <= endRow; r += 1) {
    for (const c of colIndices) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') {
        cell.z = fmt;
      }
    }
  }
}

export function buildOrdersWorkbook(orders: Order[]): XLSX.WorkBook {
  const headers = [
    'Mã đơn',
    'Ngày đặt',
    'Nhánh thương hiệu',
    'Tên người nhận',
    'SĐT',
    'Địa chỉ',
    'Chi tiết mẫu & size',
    'Số lượng',
    'Tổng tiền hàng',
    'Giảm giá',
    'Thành tiền sau giảm',
    'Hình thức vận chuyển',
    'Cước phí VC',
    'Tiền thu hộ COD',
    'Trạng thái thanh toán',
    'Trạng thái giao hàng',
    'Người tạo đơn',
    'Ghi chú',
  ];

  const dataRows: Array<Array<string | number>> = orders.map((o) => {
    const itemDesc = o.items
      .map((i) => `${i.productCode} ${i.productName} (Size ${i.size}) x${i.quantity}`)
      .join('; ');
    const totalQty = o.items.reduce((sum, i) => sum + i.quantity, 0);
    const itemsSubtotal = getOrderItemsSubtotal(o);
    const discountAmount = o.discount || 0;
    const totalAmount = getOrderTotal(o);
    const codAmount = getOrderCOD(o);
    const noteText = o.isCancelled
      ? `[ĐÃ HỦY] ${o.note || ''}`.trim()
      : o.note || '';

    return [
      o.code,
      formatDateVN(o.date),
      o.brand,
      o.customerName,
      o.customerPhone,
      o.shippingAddress,
      itemDesc,
      totalQty,
      itemsSubtotal,
      discountAmount,
      totalAmount,
      o.shippingMethod,
      o.shopShippingCost || 0,
      codAmount,
      o.isCancelled ? 'Đã hủy đơn' : o.paymentStatus,
      o.shippingStatus,
      o.createdBy || 'Hệ thống',
      noteText,
    ];
  });

  const activeOrders = orders.filter((o) => !o.isCancelled);
  const sumQty = activeOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const sumSubtotal = activeOrders.reduce((sum, o) => sum + getOrderItemsSubtotal(o), 0);
  const sumDiscount = activeOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const sumTotal = activeOrders.reduce((sum, o) => sum + getOrderTotal(o), 0);
  const sumShipCost = activeOrders.reduce((sum, o) => sum + (o.shopShippingCost || 0), 0);
  const sumCOD = activeOrders.reduce((sum, o) => sum + getOrderCOD(o), 0);

  const summaryRow: Array<string | number> = [
    'TỔNG CỘNG (Đơn hoạt động)',
    '',
    '',
    `${activeOrders.length} đơn`,
    '',
    '',
    '',
    sumQty,
    sumSubtotal,
    sumDiscount,
    sumTotal,
    '',
    sumShipCost,
    sumCOD,
    '',
    '',
    '',
    '',
  ];

  const aoa = [headers, ...dataRows, summaryRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applyNumberFormat(ws, [7, 8, 9, 10, 12, 13], 1, aoa.length - 1);
  autoFitColumns(ws, aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_sach_don_hang');
  return wb;
}

export function downloadOrdersXLSX(
  orders: Order[],
  dateISO: string = getTodayISO(),
  shippingFilter: ShippingExportFilter = 'all'
): string {
  const wb = buildOrdersWorkbook(orders);
  const suffix = shippingFilter === 'all' ? '' : `_${getShippingMethodSlug(shippingFilter)}`;
  const filename = `Danh_sach_don_hang${suffix}_${formatFilenameDate(dateISO)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

export function buildOrderRecipientsWorkbook(
  orders: Order[],
  shippingFilter: ShippingExportFilter = 'all',
  options: { includeCancelled?: boolean } = {}
): XLSX.WorkBook {
  const matched = filterOrdersByShippingMethod(orders, shippingFilter, options);
  const headers = ['Tên người nhận', 'Số điện thoại', 'Địa chỉ'];
  const rows: Array<Array<string>> = matched.map((o) => [
    String(o.customerName ?? ''),
    String(o.customerPhone ?? ''),
    String(o.shippingAddress ?? ''),
  ]);

  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Preserve leading zeros in phone numbers (col index 1) by marking as text format
  for (let r = 1; r < aoa.length; r += 1) {
    const addr = XLSX.utils.encode_cell({ r, c: 1 });
    const cell = ws[addr];
    if (cell) {
      cell.t = 's';
      cell.z = '@';
    }
  }

  autoFitColumns(ws, aoa, 16, 65);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_sach_nguoi_nhan');
  return wb;
}

export function downloadOrderRecipientsXLSX(
  orders: Order[],
  shippingFilter: ShippingExportFilter = 'all',
  dateISO: string = getTodayISO(),
  options: { includeCancelled?: boolean } = {}
): string {
  const wb = buildOrderRecipientsWorkbook(orders, shippingFilter, options);
  const filename = `Danh_sach_nguoi_nhan_${getShippingMethodSlug(shippingFilter)}_${formatFilenameDate(dateISO)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

export function buildFinanceWorkbook(state: AppState): XLSX.WorkBook {
  const fund = computeFundSummary(state.shareholders, state.expenses);
  const pnl = computeBrandPnL(state.products, state.stockImports, state.orders, state.expenses);

  // Sheet 1: Tong_hop_P&L
  const s1Rows: Array<Array<string | number>> = [
    ['BÁO CÁO TỔNG HỢP TÀI CHÍNH & LÃI LỖ (P&L)'],
    [`Ngày xuất báo cáo: ${formatDateVN(getTodayISO())}`],
    [],
    ['1. QUỸ TIỀN MẶT HIỆN TẠI'],
    ['Chỉ tiêu', 'Giá trị (VNĐ)', 'Ghi chú'],
    ['Tổng vốn góp ban đầu', fund.totalCapital, `${state.shareholders.length} cổ đông`],
    ['Tổng các khoản đã chi', fund.totalSpent, `${state.expenses.length} chứng từ chi`],
    ['Số dư quỹ hiện tại', fund.currentBalance, 'Vốn ban đầu - Tổng đã chi'],
    [],
    ['2. CHI TIẾT GÓP VỐN CỔ ĐÔNG'],
    ['Cổ đông', 'Số tiền góp (VNĐ)', 'Tỷ lệ (%)', 'Ghi chú'],
  ];

  for (const sh of state.shareholders) {
    const pct = fund.totalCapital > 0 ? Number(((sh.contribution / fund.totalCapital) * 100).toFixed(1)) : 0;
    s1Rows.push([sh.name, sh.contribution, pct, sh.note || '']);
  }
  s1Rows.push(['Tổng vốn góp cổ đông', fund.totalCapital, fund.totalCapital > 0 ? 100 : 0, '']);
  s1Rows.push([]);
  s1Rows.push(['3. BẢNG LÃI / LỖ THEO NHÁNH THƯƠNG HIỆU (P&L)']);
  const pnlHeaderRowIndex = s1Rows.length;
  s1Rows.push([
    'Nhánh thương hiệu',
    'Phân loại',
    'Số đơn hoạt động',
    'Tổng giá nhập (VNĐ)',
    'Tổng giá bán (VNĐ)',
    'Chi phí vận hành (VNĐ)',
    'Lợi nhuận (VNĐ)',
  ]);

  for (const row of pnl.byBrand) {
    s1Rows.push([
      row.brand,
      BRAND_SUBTITLES[row.brand],
      row.activeOrderCount,
      row.importCost,
      row.salesRevenue,
      row.operatingExpense,
      row.profit,
    ]);
  }
  s1Rows.push([
    'Tổng cộng toàn hệ thống',
    '3 nhánh',
    pnl.total.activeOrderCount,
    pnl.total.importCost,
    pnl.total.salesRevenue,
    pnl.total.operatingExpense,
    pnl.total.profit,
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);
  applyNumberFormat(ws1, [1], 5, 7);
  applyNumberFormat(ws1, [1], 11, 11 + state.shareholders.length);
  applyNumberFormat(ws1, [2, 3, 4, 5, 6], pnlHeaderRowIndex + 1, s1Rows.length - 1);
  autoFitColumns(ws1, s1Rows);

  // Sheet 2: Doanh_thu_Don_hang
  const activeOrders = state.orders.filter((o) => !o.isCancelled);
  const s2Headers = [
    'Mã đơn',
    'Ngày đặt',
    'Nhánh thương hiệu',
    'Khách hàng',
    'SĐT',
    'Chi tiết sản phẩm',
    'Tiền hàng (VNĐ)',
    'Phí ship khách trả (VNĐ)',
    'Giảm giá (VNĐ)',
    'Tổng doanh thu đơn (VNĐ)',
    'Tiền thu hộ COD (VNĐ)',
    'Cước VC shop trả (VNĐ)',
    'Trạng thái thanh toán',
    'Trạng thái giao hàng',
    'Người tạo đơn',
    'Ghi chú',
  ];

  const s2Body: Array<Array<string | number>> = activeOrders.map((o) => {
    const subtotal = getOrderItemsSubtotal(o);
    const total = getOrderTotal(o);
    const cod = getOrderCOD(o);
    const desc = o.items
      .map((i) => `${i.productCode} ${i.productName} (${i.size}) x${i.quantity}`)
      .join('; ');
    return [
      o.code,
      formatDateVN(o.date),
      o.brand,
      o.customerName,
      o.customerPhone,
      desc,
      subtotal,
      o.shippingFee || 0,
      o.discount || 0,
      total,
      cod,
      o.shopShippingCost || 0,
      o.paymentStatus,
      o.shippingStatus,
      o.createdBy || 'Hệ thống',
      o.note || '',
    ];
  });

  const s2SumSubtotal = activeOrders.reduce((s, o) => s + getOrderItemsSubtotal(o), 0);
  const s2SumShipCustomer = activeOrders.reduce((s, o) => s + (o.shippingFee || 0), 0);
  const s2SumDiscount = activeOrders.reduce((s, o) => s + (o.discount || 0), 0);
  const s2SumTotal = activeOrders.reduce((s, o) => s + getOrderTotal(o), 0);
  const s2SumCOD = activeOrders.reduce((s, o) => s + getOrderCOD(o), 0);
  const s2SumShopShip = activeOrders.reduce((s, o) => s + (o.shopShippingCost || 0), 0);

  const s2TotalRow: Array<string | number> = [
    'TỔNG CỘNG',
    '',
    '',
    `${activeOrders.length} đơn`,
    '',
    '',
    s2SumSubtotal,
    s2SumShipCustomer,
    s2SumDiscount,
    s2SumTotal,
    s2SumCOD,
    s2SumShopShip,
    '',
    '',
    '',
    '',
  ];

  const s2Aoa = [s2Headers, ...s2Body, s2TotalRow];
  const ws2 = XLSX.utils.aoa_to_sheet(s2Aoa);
  applyNumberFormat(ws2, [6, 7, 8, 9, 10, 11], 1, s2Aoa.length - 1);
  autoFitColumns(ws2, s2Aoa);

  // Sheet 3: Chi_tiet_Khoan_chi
  const s3Headers = [
    'Ngày chi',
    'Hạng mục',
    'Phân bổ nhánh',
    'Chi tiết khoản chi',
    'Số tiền (VNĐ)',
    'Người ứng chi',
    'Tình trạng',
    'Người nhập liệu',
    'Hóa đơn / Ghi chú',
  ];

  const s3Body: Array<Array<string | number>> = state.expenses.map((e) => [
    formatDateVN(e.date),
    e.category,
    e.brandScope,
    e.detail,
    e.amount,
    e.paidBy,
    e.status,
    e.enteredBy || 'Hệ thống',
    e.receiptNote || '',
  ]);

  const s3TotalRow: Array<string | number> = [
    'TỔNG CỘNG',
    '',
    '',
    `${state.expenses.length} khoản chi`,
    fund.totalSpent,
    '',
    '',
    '',
    '',
  ];

  const s3Aoa = [s3Headers, ...s3Body, s3TotalRow];
  const ws3 = XLSX.utils.aoa_to_sheet(s3Aoa);
  applyNumberFormat(ws3, [4], 1, s3Aoa.length - 1);
  autoFitColumns(ws3, s3Aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Tong_hop_P&L');
  XLSX.utils.book_append_sheet(wb, ws2, 'Doanh_thu_Don_hang');
  XLSX.utils.book_append_sheet(wb, ws3, 'Chi_tiet_Khoan_chi');
  return wb;
}

export function downloadFinanceXLSX(state: AppState, dateISO: string = getTodayISO()): string {
  const wb = buildFinanceWorkbook(state);
  const filename = `Bao_cao_Tai_chinh_Thu_Chi_${formatFilenameDate(dateISO)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
