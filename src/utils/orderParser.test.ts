import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../data/seedData';
import { Brand } from '../types/erp';
import { parseQuickOrderText } from './orderParser';

test('parses exact user example: Chị Lan 0912345678 lấy 1 bộ Tơ Nhã Hoa Mai size M', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const res = parseQuickOrderText(
    'Chị Lan 0912345678 lấy 1 bộ Tơ Nhã Hoa Mai size M',
    seed.products
  );

  assert.equal(res.customerName, 'Chị Lan');
  assert.equal(res.customerPhone, '0912345678');
  assert.equal(res.brand, Brand.TO_NHA);
  assert.equal(res.productId, 'prd_tn_03');
  assert.equal(res.size, 'M');
  assert.equal(res.quantity, 1);
});

test('parses unaccented text with spaced phone number and Freesize', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const res = parseQuickOrderText(
    'Anh Minh - 0987.654.321 dat 2 hop Van Mien O Long Phuong Hoang freesize',
    seed.products
  );

  assert.equal(res.customerName, 'Anh Minh');
  assert.equal(res.customerPhone, '0987654321');
  assert.equal(res.brand, Brand.VAN_MIEN);
  assert.equal(res.productId, 'prd_vm_01');
  assert.equal(res.size, 'Freesize');
  assert.equal(res.quantity, 2);
});

test('parses SKU code, +84 phone, and sz L shorthand', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const res = parseQuickOrderText(
    'Khách: Trần Hải +84 904 551 228 chốt TV-01 sz L x3',
    seed.products
  );

  assert.equal(res.customerName, 'Trần Hải');
  assert.equal(res.customerPhone, '0904551228');
  assert.equal(res.brand, Brand.TO_VUONG);
  assert.equal(res.productId, 'prd_tv_01');
  assert.equal(res.size, 'L');
  assert.equal(res.quantity, 3);
});

test('handles unmatched product gracefully while still extracting name, phone, brand, and size', () => {
  const seed = createSeedState(new Date('2026-11-16T10:00:00'));
  const res = parseQuickOrderText(
    'Cô Mai 0911222333 đặt 1 bộ Tơ Nhã Mẫu Chưa Có size S',
    seed.products
  );

  assert.equal(res.customerName, 'Cô Mai');
  assert.equal(res.customerPhone, '0911222333');
  assert.equal(res.brand, Brand.TO_NHA);
  assert.equal(res.productId, undefined);
  assert.equal(res.size, 'S');
  assert.equal(res.quantity, 1);
  assert.ok(res.unmatchedProductHint);
});
