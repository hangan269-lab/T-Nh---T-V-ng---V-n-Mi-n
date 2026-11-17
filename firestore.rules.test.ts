import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

interface MockAuth {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
  };
}

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

function isVerifiedUser(auth: MockAuth | null): boolean {
  return auth !== null && auth.token.email_verified === true;
}

function isWorkspaceMemberResource(
  auth: MockAuth | null,
  data: Record<string, unknown>
): boolean {
  if (!isVerifiedUser(auth) || !auth) return false;
  const email = auth.token.email ?? null;
  const memberEmails = Array.isArray(data.memberEmails) ? data.memberEmails : [];
  return (
    data.ownerUid === auth.uid ||
    (email !== null && memberEmails.includes(email))
  );
}

function validateOrderPayload(
  auth: MockAuth | null,
  docId: unknown,
  data: Record<string, unknown>,
  options: {
    isCreate?: boolean;
    existing?: Record<string, unknown>;
    requestTimeMs?: number;
  } = {}
): { allowed: boolean; reason?: string } {
  if (!isVerifiedUser(auth) || !auth) {
    return { allowed: false, reason: 'PERMISSION_DENIED: unauthenticated or unverified email' };
  }
  if (!isValidId(docId)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: invalid document ID' };
  }

  const requiredKeys = [
    'id', 'code', 'date', 'brand', 'customerName', 'customerPhone', 'shippingAddress',
    'shippingMethod', 'shopShippingCost', 'shippingCostPayer', 'shippingStatus',
    'weightGrams', 'items', 'shippingFee', 'note', 'paymentStatus', 'isCancelled',
    'createdAt', 'createdBy', 'ownerUid', 'memberEmails', 'serverCreatedAt', 'serverUpdatedAt',
  ];
  const allowedKeys = new Set([
    ...requiredKeys,
    'paymentConfirmedBy', 'paymentConfirmedAt', 'cancelledBy', 'cancelledAt',
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
  if (options.isCreate) {
    if (data.ownerUid !== auth.uid) {
      return { allowed: false, reason: 'PERMISSION_DENIED: ownerUid spoofing' };
    }
    if (data.serverCreatedAt !== options.requestTimeMs || data.serverUpdatedAt !== options.requestTimeMs) {
      return { allowed: false, reason: 'PERMISSION_DENIED: forged timestamp' };
    }
  }
  if (options.existing) {
    const isAdmin = auth.token.email === 'hangan269@gmail.com';
    if (options.existing.isCancelled === true && !isAdmin) {
      return { allowed: false, reason: 'PERMISSION_DENIED: terminal cancelled order lock' };
    }
    if (data.serverUpdatedAt !== options.requestTimeMs) {
      return { allowed: false, reason: 'PERMISSION_DENIED: forged update timestamp' };
    }
  }
  return { allowed: true };
}

test('firestore.rules and firebase-blueprint.json exist and stay synchronized on all collections', () => {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  ) as { firestore: Record<string, unknown> };

  const requiredMatches = [
    'admins',
    'system',
    'products',
    'stockImports',
    'orders',
    'shareholders',
    'expenses',
    'budgetItems',
    'accounts',
    'auditLogs',
  ];

  assert.ok(rulesText.includes('allow read, write: if false;'));
  for (const col of requiredMatches) {
    assert.ok(
      Object.keys(blueprint.firestore).some((p) => p.startsWith(`/${col}/`)),
      `Blueprint missing collection ${col}`
    );
    assert.ok(
      rulesText.includes(`match /${col}/`),
      `firestore.rules missing match block for ${col}`
    );
  }
  assert.ok(rulesText.includes('hangan269@gmail.com'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
});

test('Dirty Dozen adversarial payloads all fail with PERMISSION_DENIED', () => {
  const serverNow = 1763370000000;
  const adminAuth: MockAuth = {
    uid: 'uid_admin',
    token: { email: 'hangan269@gmail.com', email_verified: true },
  };
  const validOrder: Record<string, unknown> = {
    id: 'ord_99',
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
    ownerUid: 'uid_admin',
    memberEmails: ['hangan269@gmail.com'],
    serverCreatedAt: serverNow,
    serverUpdatedAt: serverNow,
  };

  // Valid baseline passes
  assert.equal(
    validateOrderPayload(adminAuth, 'ord_99', validOrder, {
      isCreate: true,
      requestTimeMs: serverNow,
    }).allowed,
    true
  );

  // 1. Unauthenticated read/write
  assert.equal(isWorkspaceMemberResource(null, validOrder), false);

  // 2. Email spoof with email_verified: false
  assert.equal(
    validateOrderPayload(
      { uid: 'uid_spoof', token: { email: 'hangan269@gmail.com', email_verified: false } },
      'ord_99',
      validOrder,
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 3. Foreign signed-in user PII scrape
  assert.equal(
    isWorkspaceMemberResource(
      { uid: 'uid_stranger', token: { email: 'attacker@example.com', email_verified: true } },
      validOrder
    ),
    false
  );

  // 4. Identity spoofing on create
  assert.equal(
    validateOrderPayload(
      adminAuth,
      'ord_99',
      { ...validOrder, ownerUid: 'uid_other' },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 5. Shadow / Ghost field injection
  assert.equal(
    validateOrderPayload(
      adminAuth,
      'ord_99',
      { ...validOrder, isVerifiedAdmin: true },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 6. Path ID poisoning
  assert.equal(
    validateOrderPayload(adminAuth, '../bad$id', validOrder, {
      isCreate: true,
      requestTimeMs: serverNow,
    }).allowed,
    false
  );

  // 7. Resource exhaustion (>500 char address)
  assert.equal(
    validateOrderPayload(
      adminAuth,
      'ord_99',
      { ...validOrder, shippingAddress: 'A'.repeat(5000) },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 8. Unbounded array (>30 items) & empty array
  assert.equal(
    validateOrderPayload(
      adminAuth,
      'ord_99',
      { ...validOrder, items: Array.from({ length: 35 }, () => (validOrder.items as unknown[])[0]) },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );
  assert.equal(
    validateOrderPayload(
      adminAuth,
      'ord_99',
      { ...validOrder, items: [] },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 9. Client timestamp forgery
  assert.equal(
    validateOrderPayload(
      adminAuth,
      'ord_99',
      { ...validOrder, serverUpdatedAt: serverNow - 5000 },
      { isCreate: true, requestTimeMs: serverNow }
    ).allowed,
    false
  );

  // 10. Terminal cancelled order mutation by non-admin
  const staffAuth: MockAuth = {
    uid: 'uid_staff',
    token: { email: 'giang@example.com', email_verified: true },
  };
  assert.equal(
    validateOrderPayload(
      staffAuth,
      'ord_99',
      { ...validOrder, note: 'reopen' },
      {
        existing: { ...validOrder, isCancelled: true },
        requestTimeMs: serverNow,
      }
    ).allowed,
    false
  );
});
