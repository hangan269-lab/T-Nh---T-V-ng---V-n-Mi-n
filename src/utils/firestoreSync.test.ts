import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, createSeedState, getDefaultPinForAccount } from '../data/seedData';
import {
  BLUEPRINT_LIMITS,
  computeStateDiffOps,
  sanitizeEntityForCollection,
  sanitizeId,
  sanitizeOrderPayload,
  WORKSPACE_ID,
} from './firestoreSanitize';
import { createOrderWithValidation, deleteOrderWithAudit } from './finance';

test('default workspace constant and per-member PIN mapping are configured accurately', () => {
  assert.equal(WORKSPACE_ID, 'nhavuongmien_studio');
  const seed = createSeedState();
  assert.equal(getDefaultPinForAccount(seed.accounts[0]), '1111');
  assert.equal(getDefaultPinForAccount(seed.accounts[1]), '2222');
  assert.equal(getDefaultPinForAccount(seed.accounts[2]), '3333');
  assert.equal(getDefaultPinForAccount(seed.accounts[3]), '4444');
  assert.equal(getDefaultPinForAccount(seed.accounts[4]), '5555');
});

test('sanitizeId strips invalid Firestore path characters and enforces length limit', () => {
  assert.equal(sanitizeId('ord_01-VN'), 'ord_01-VN');
  assert.equal(sanitizeId('../bad/id$!'), '___bad_id__');
  assert.ok(sanitizeId('a'.repeat(300)).length <= BLUEPRINT_LIMITS.ID_MAX);
});

test('sanitizeOrderPayload clamps oversized strings, strips undefined optionals, and bounds items', () => {
  const seed = createSeedState();
  const baseOrder = seed.orders[0];
  const oversized = {
    ...baseOrder,
    customerName: 'X'.repeat(400),
    shippingAddress: 'Y'.repeat(1200),
    note: 'Z'.repeat(900),
    items: Array.from({ length: 45 }, () => baseOrder.items[0]),
    paymentConfirmedBy: undefined,
  };
  const sanitized = sanitizeOrderPayload(oversized);
  assert.equal((sanitized.customerName as string).length, BLUEPRINT_LIMITS.NAME_MAX);
  assert.equal((sanitized.shippingAddress as string).length, BLUEPRINT_LIMITS.ADDRESS_MAX);
  assert.equal((sanitized.note as string).length, BLUEPRINT_LIMITS.NOTE_MAX);
  assert.equal((sanitized.items as unknown[]).length, BLUEPRINT_LIMITS.ORDER_ITEMS_MAX);
  assert.equal('paymentConfirmedBy' in sanitized, false);
});

test('computeStateDiffOps produces minimal per-document batch ops across all 8 collections', () => {
  const prev = createSeedState();
  const created = createOrderWithValidation(prev, {
    date: prev.orders[0].date,
    brand: prev.products[0].brand,
    customerName: 'Khách Đồng Bộ',
    customerPhone: '0909888777',
    shippingAddress: '10 Hàng Đào, Hoàn Kiếm, Hà Nội',
    shippingMethod: prev.orders[1].shippingMethod,
    shopShippingCost: 25000,
    shippingCostPayer: 'Ngân chi',
    items: [{ productId: prev.products[0].id, size: 'S', quantity: 1 }],
    shippingFee: 0,
    note: 'Test sync',
    paymentStatus: prev.orders[1].paymentStatus,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const diffCreate = computeStateDiffOps(prev, created.state);
  assert.equal(diffCreate.deletes.length, 0);
  assert.equal(diffCreate.upserts.length, 3); // 1 order + 1 linked shipping expense + 1 audit log
  assert.ok(diffCreate.upserts.some((u) => u.collection === 'orders' && u.isCreate));
  assert.ok(diffCreate.upserts.some((u) => u.collection === 'expenses' && u.isCreate));
  assert.ok(diffCreate.upserts.some((u) => u.collection === 'auditLogs' && u.isCreate));

  const afterDelete = deleteOrderWithAudit(created.state, created.order.id);
  const diffDelete = computeStateDiffOps(created.state, afterDelete);
  assert.equal(diffDelete.deletes.length, 2); // deleted order + linked expense
  assert.equal(diffDelete.upserts.length, 2); // 1 delete audit log + 1 pre-delete backup snapshot
  assert.ok(diffDelete.upserts.some((u) => u.collection === 'auditLogs' && u.isCreate));
  assert.ok(diffDelete.upserts.some((u) => u.collection === 'backups' && u.isCreate));

  const empty = createEmptyState(prev.accounts);
  const diffReset = computeStateDiffOps(prev, empty);
  assert.equal(diffReset.updateSystemMeta, true);
  assert.ok(diffReset.deletes.some((d) => d.collection === 'orders'));
  assert.ok(diffReset.deletes.some((d) => d.collection === 'products'));
  assert.equal(
    diffReset.deletes.some((d) => d.collection === 'accounts'),
    false
  );
});

test('all seed records and backup snapshots sanitize cleanly with no undefined values', () => {
  const seed = createSeedState();
  for (const p of seed.products) {
    const out = sanitizeEntityForCollection('products', p);
    for (const v of Object.values(out)) {
      assert.notEqual(v, undefined);
    }
  }
  const afterDel = deleteOrderWithAudit(seed, 'ord_02');
  const bakOut = sanitizeEntityForCollection('backups', afterDel.backups[0]);
  assert.equal(JSON.stringify(bakOut).includes('undefined'), false);
  assert.ok(Array.isArray((bakOut.snapshot as { orders: unknown[] }).orders));
});

test('sanitizeNotificationPayload enforces type, clamps lengths, and deduplicates readBy', () => {
  const sanitized = sanitizeEntityForCollection('notifications', {
    id: 'ntf/test$1',
    title: 'T'.repeat(300),
    message: 'M'.repeat(800),
    type: 'order',
    actorId: 'acc_giang',
    actorName: 'Giang',
    createdAt: '2026-11-18T10:00:00.000Z',
    readBy: ['acc_giang', 'acc_giang', '', 'acc_ngan'],
  });
  assert.equal(sanitized.id, 'ntf_test_1');
  assert.equal((sanitized.title as string).length, BLUEPRINT_LIMITS.NAME_MAX);
  assert.equal((sanitized.message as string).length, BLUEPRINT_LIMITS.NOTE_MAX);
  assert.deepEqual(sanitized.readBy, ['acc_giang', 'acc_ngan']);
});
