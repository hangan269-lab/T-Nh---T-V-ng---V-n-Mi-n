import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

function validateOrderPayload(
  docId: unknown,
  data: Record<string, unknown>,
  options: {
    isSignedIn?: boolean;
    isCreate?: boolean;
    existing?: Record<string, unknown>;
    requestTimeMs?: number;
  } = {}
): { allowed: boolean; reason?: string } {
  if (options.isSignedIn === false) {
    return { allowed: false, reason: 'PERMISSION_DENIED: unauthenticated client (request.auth == null)' };
  }
  if (!isValidId(docId)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: invalid document ID' };
  }
  if (data.workspaceId !== 'nhavuongmien_studio') {
    return { allowed: false, reason: 'PERMISSION_DENIED: foreign or missing workspaceId' };
  }

  const requiredKeys = [
    'id', 'workspaceId', 'code', 'date', 'brand', 'customerName', 'customerPhone', 'shippingAddress',
    'shippingMethod', 'shopShippingCost', 'shippingCostPayer', 'shippingStatus',
    'weightGrams', 'items', 'shippingFee', 'note', 'paymentStatus', 'isCancelled',
    'createdAt', 'createdBy', 'serverCreatedAt', 'serverUpdatedAt',
  ];
  const allowedKeys = new Set([
    ...requiredKeys,
    'discount', 'paymentConfirmedBy', 'paymentConfirmedAt', 'cancelledBy', 'cancelledAt',
  ]);

  for (const req of requiredKeys) {
    if (!(req in data)) {
      return { allowed: false, reason: `PERMISSION_DENIED: missing required key ${req}` };
    }
  }
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) {
      return { allowed: false, reason: `PERMISSION_DENIED: shadow/ghost field ${key}` };
    }
  }
  if (typeof data.shippingAddress !== 'string' || data.shippingAddress.length > 500) {
    return { allowed: false, reason: 'PERMISSION_DENIED: shippingAddress size limit exceeded' };
  }
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 30) {
    return { allowed: false, reason: 'PERMISSION_DENIED: items array out of bounds (1..30)' };
  }
  if (
    'discount' in data &&
    (typeof data.discount !== 'number' || data.discount < 0 || data.discount > 100000000)
  ) {
    return { allowed: false, reason: 'PERMISSION_DENIED: invalid discount value' };
  }
  if (options.isCreate) {
    if (data.serverCreatedAt !== options.requestTimeMs || data.serverUpdatedAt !== options.requestTimeMs) {
      return { allowed: false, reason: 'PERMISSION_DENIED: forged timestamp' };
    }
  }
  if (options.existing) {
    if (
      'serverCreatedAt' in options.existing &&
      data.serverCreatedAt !== options.existing.serverCreatedAt
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: mutated serverCreatedAt' };
    }
    if (data.serverUpdatedAt !== options.requestTimeMs) {
      return { allowed: false, reason: 'PERMISSION_DENIED: forged update timestamp' };
    }
  }
  return { allowed: true };
}

test('firestore.rules and firebase-blueprint.json stay synchronized and enforce Anonymous Auth (request.auth != null)', () => {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  ) as { firestore: Record<string, unknown> };

  const requiredMatches = [
    'system',
    'products',
    'stockImports',
    'orders',
    'shareholders',
    'expenses',
    'budgetItems',
    'accounts',
    'auditLogs',
    'backups',
    'chinaPartners',
    'notifications',
  ];

  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('nhavuongmien_studio'));
  assert.ok(rulesText.includes('function isSignedIn()'));
  assert.ok(rulesText.includes('request.auth != null'));
  assert.equal(rulesText.includes('email_verified'), false);

  for (const col of requiredMatches) {
    assert.ok(
      Object.keys(blueprint.firestore).some((p) => p.startsWith(`/${col}/`)),
      `Blueprint missing collection ${col}`
    );
    const matchRegex = new RegExp(`match /${col}/\\{[^}]+\\}\\s*\\{([\\s\\S]*?)\\n    \\}`);
    const matchBlock = matchRegex.exec(rulesText);
    assert.ok(matchBlock, `firestore.rules missing match block for ${col}`);
    const blockBody = matchBlock[1];
    for (const op of ['get', 'list', 'create', 'update', 'delete']) {
      const opRegex = new RegExp(`allow ${op}: if isSignedIn\\(\\)`);
      assert.ok(
        opRegex.test(blockBody),
        `firestore.rules collection ${col} missing isSignedIn() check on ${op}`
      );
    }
  }
});

test('Adversarial payloads fail schema, size, path, workspace, and timestamp checks', () => {
  const serverNow = 1763370000000;
  const validOrder: Record<string, unknown> = {
    id: 'ord_99',
    workspaceId: 'nhavuongmien_studio',
    code: 'DH-0099',
    date: '2026-11-17',
    brand: 'Tơ Nhã',
    customerName: 'Chị Lan',
    customerPhone: '0912345678',
    shippingAddress: '18 Hàng Bông, Hoàn Kiếm, Hà Nội',
    shippingMethod: 'Viettel Post',
    shopShippingCost: 30000,
    shippingCostPayer: 'Ngân chi',
    shippingStatus: 'Chưa gửi',
    weightGrams: 500,
    items: [
      {
        productId: 'prd_tn_01',
        productCode: 'TN-01',
        productName: 'Áo dài Lụa Ngọc Bích',
        size: 'M',
        quantity: 1,
        unitPrice: 1450000,
      },
    ],
    shippingFee: 0,
    note: '',
    paymentStatus: 'Chưa thanh toán',
    isCancelled: false,
    createdAt: '2026-11-17T08:00:00Z',
    createdBy: 'Ngân',
    serverCreatedAt: serverNow,
    serverUpdatedAt: serverNow,
  };

  // Valid baseline passes
  assert.equal(
    validateOrderPayload('ord_99', validOrder, {
      isSignedIn: true,
      isCreate: true,
      requestTimeMs: serverNow,
    }).allowed,
    true
  );

  // 0. Unauthenticated client (request.auth == null) rejected
  assert.equal(
    validateOrderPayload('ord_99', validOrder, {
      isSignedIn: false,
      isCreate: true,
      requestTimeMs: serverNow,
    }).allowed,
    false
  );

  // 1. Foreign workspaceId rejected
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, workspaceId: 'foreign_workspace' },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 2. Shadow / Ghost field injection rejected
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, isVerifiedAdmin: true },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 3. Path ID poisoning rejected
  assert.equal(
    validateOrderPayload('../bad$id', validOrder, {
      isCreate: true,
      requestTimeMs: serverNow,
    }).allowed,
    false
  );

  // 4. Resource exhaustion (>500 char address) rejected
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, shippingAddress: 'A'.repeat(5000) },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 5. Unbounded array (>30 items) & empty array rejected
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, items: Array.from({ length: 35 }, () => (validOrder.items as unknown[])[0]) },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, items: [] },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 6. Client timestamp forgery & immutable serverCreatedAt tampering rejected
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, serverUpdatedAt: serverNow - 5000 },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, serverCreatedAt: serverNow - 1000 },
      { existing: validOrder, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 7. Optional discount: valid promotional discount allowed, negative discount rejected
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, discount: 200000 },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    true
  );
  assert.equal(
    validateOrderPayload(
      'ord_99',
      { ...validOrder, discount: -50000 },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );
});
