import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { createSeedState } from '../data/seedData';
import { db } from '../firebase';
import {
  AppState,
  AuditLogEntry,
  BudgetItem,
  Expense,
  Order,
  Product,
  Shareholder,
  StockImport,
  UserAccount,
} from '../types/erp';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  BUSINESS_COLLECTIONS,
  BusinessCollectionName,
  computeMemberEmails,
  computeStateDiffOps,
  sanitizeEntityForCollection,
  SYSTEM_META_DOC_ID,
  WORKSPACE_ADMIN_EMAIL,
} from './firestoreSanitize';

export interface FirestoreDocMeta {
  ownerUid: string;
  memberEmails: string[];
  serverCreatedAt: unknown;
}

export type FirestoreMetaCache = Map<string, FirestoreDocMeta>;

function metaKey(col: string, id: string): string {
  return `${col}/${id}`;
}

function stripFirestoreMetaFields<T extends Record<string, unknown>>(raw: Record<string, unknown>): T {
  const {
    ownerUid: _ownerUid,
    memberEmails: _memberEmails,
    serverCreatedAt: _serverCreatedAt,
    serverUpdatedAt: _serverUpdatedAt,
    ...rest
  } = raw;
  return rest as T;
}

export async function ensureAdminBootstrapped(user: User): Promise<void> {
  if (!user.email || user.email.toLowerCase() !== WORKSPACE_ADMIN_EMAIL) {
    return;
  }
  const adminRef = doc(db, 'admins', user.uid);
  try {
    const snap = await getDocFromServer(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        email: user.email,
        role: 'Admin',
        serverCreatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${user.uid}`);
  }
}

async function commitOperationsInBatches(
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  operationType: OperationType,
  path: string
): Promise<void> {
  const CHUNK_SIZE = 420;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const apply of chunk) {
      apply(batch);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, operationType, path);
    }
  }
}

export async function ensureWorkspaceSeeded(
  user: User,
  metaCache: FirestoreMetaCache
): Promise<void> {
  const userEmail = (user.email ?? '').trim().toLowerCase();
  if (!userEmail) return;

  await ensureAdminBootstrapped(user);

  let systemEmpty = true;
  try {
    const systemQuery = query(
      collection(db, 'system'),
      where('memberEmails', 'array-contains', userEmail)
    );
    const systemSnap = await getDocsFromServer(systemQuery);
    systemEmpty = systemSnap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'system');
  }

  if (!systemEmpty) {
    return;
  }

  // Also check if accounts already exist before seeding
  let accountsEmpty = true;
  try {
    const accQuery = query(
      collection(db, 'accounts'),
      where('memberEmails', 'array-contains', userEmail)
    );
    const accSnap = await getDocsFromServer(accQuery);
    accountsEmpty = accSnap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'accounts');
  }

  const memberEmails = computeMemberEmails([], userEmail);

  if (!accountsEmpty) {
    // Workspace has data without system/meta; create system/meta preserving existing accounts
    const metaRef = doc(db, 'system', SYSTEM_META_DOC_ID);
    const ts = serverTimestamp();
    try {
      await setDoc(metaRef, {
        id: SYSTEM_META_DOC_ID,
        isSampleData: false,
        seeded: true,
        ownerUid: user.uid,
        memberEmails,
        serverCreatedAt: ts,
        serverUpdatedAt: ts,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `system/${SYSTEM_META_DOC_ID}`);
    }
    return;
  }

  const seed = createSeedState();
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const ts = serverTimestamp();

  operations.push((batch) => {
    const metaRef = doc(db, 'system', SYSTEM_META_DOC_ID);
    batch.set(metaRef, {
      id: SYSTEM_META_DOC_ID,
      isSampleData: true,
      seeded: true,
      ownerUid: user.uid,
      memberEmails,
      serverCreatedAt: ts,
      serverUpdatedAt: ts,
    });
  });

  for (const col of BUSINESS_COLLECTIONS) {
    const list = seed[col] as Array<{ id: string }>;
    for (const item of list) {
      const sanitized = sanitizeEntityForCollection(col, item);
      const id = String(sanitized.id);
      metaCache.set(metaKey(col, id), {
        ownerUid: user.uid,
        memberEmails,
        serverCreatedAt: ts,
      });
      operations.push((batch) => {
        batch.set(doc(db, col, id), {
          ...sanitized,
          ownerUid: user.uid,
          memberEmails,
          serverCreatedAt: ts,
          serverUpdatedAt: ts,
        });
      });
    }
  }

  await commitOperationsInBatches(operations, OperationType.CREATE, 'workspace-seed');
}

export interface RealtimeWorkspaceCallbacks {
  onStateChange: (nextState: AppState, meta: { memberEmails: string[]; syncing: boolean }) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
}

export function subscribeWorkspaceRealtime(
  user: User,
  metaCache: FirestoreMetaCache,
  callbacks: RealtimeWorkspaceCallbacks
): Unsubscribe {
  const userEmail = (user.email ?? '').trim().toLowerCase();
  if (!userEmail) {
    return () => {};
  }

  const latestCollections: Record<BusinessCollectionName, unknown[]> = {
    products: [],
    stockImports: [],
    orders: [],
    shareholders: [],
    expenses: [],
    budgetItems: [],
    accounts: [],
    auditLogs: [],
  };

  let isSampleData = false;
  let memberEmails = computeMemberEmails([], userEmail);
  const readySet = new Set<string>();
  const expectedCount = BUSINESS_COLLECTIONS.length + 1;
  let notifiedReady = false;

  const emit = () => {
    const sortedOrders = [...(latestCollections.orders as Order[])].sort((a, b) =>
      (b.createdAt || b.date).localeCompare(a.createdAt || a.date)
    );
    const sortedLogs = [...(latestCollections.auditLogs as AuditLogEntry[])].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const sortedImports = [...(latestCollections.stockImports as StockImport[])].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const sortedExpenses = [...(latestCollections.expenses as Expense[])].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const sortedProducts = [...(latestCollections.products as Product[])].sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    const sortedAccounts = [...(latestCollections.accounts as UserAccount[])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

    const nextState: AppState = {
      products: sortedProducts,
      stockImports: sortedImports,
      orders: sortedOrders,
      shareholders: latestCollections.shareholders as Shareholder[],
      expenses: sortedExpenses,
      budgetItems: latestCollections.budgetItems as BudgetItem[],
      accounts: sortedAccounts,
      auditLogs: sortedLogs,
      isSampleData,
    };

    callbacks.onStateChange(nextState, { memberEmails, syncing: false });

    if (!notifiedReady && readySet.size >= expectedCount) {
      notifiedReady = true;
      callbacks.onReady();
    }
  };

  const unsubscribes: Unsubscribe[] = [];

  // Subscribe to system metadata
  const sysQuery = query(
    collection(db, 'system'),
    where('memberEmails', 'array-contains', userEmail)
  );
  unsubscribes.push(
    onSnapshot(
      sysQuery,
      (snapshot) => {
        const metaDoc = snapshot.docs.find((d) => d.id === SYSTEM_META_DOC_ID) ?? snapshot.docs[0];
        if (metaDoc) {
          const raw = metaDoc.data() as Record<string, unknown>;
          metaCache.set(metaKey('system', metaDoc.id), {
            ownerUid: String(raw.ownerUid ?? user.uid),
            memberEmails: computeMemberEmails(raw.memberEmails as string[] | undefined, userEmail),
            serverCreatedAt: raw.serverCreatedAt,
          });
          isSampleData = Boolean(raw.isSampleData);
          memberEmails = computeMemberEmails(raw.memberEmails as string[] | undefined, userEmail);
        }
        readySet.add('system');
        emit();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'system');
        } catch (wrapped) {
          callbacks.onError(wrapped);
        }
      }
    )
  );

  // Subscribe to all 8 business collections in real time
  for (const col of BUSINESS_COLLECTIONS) {
    const colQuery = query(
      collection(db, col),
      where('memberEmails', 'array-contains', userEmail)
    );
    unsubscribes.push(
      onSnapshot(
        colQuery,
        (snapshot) => {
          const items: unknown[] = [];
          for (const docSnap of snapshot.docs) {
            const raw = docSnap.data() as Record<string, unknown>;
            metaCache.set(metaKey(col, docSnap.id), {
              ownerUid: String(raw.ownerUid ?? user.uid),
              memberEmails: computeMemberEmails(
                raw.memberEmails as string[] | undefined,
                userEmail
              ),
              serverCreatedAt: raw.serverCreatedAt,
            });
            items.push(stripFirestoreMetaFields(raw));
          }
          latestCollections[col] = items;
          readySet.add(col);
          emit();
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, col);
          } catch (wrapped) {
            callbacks.onError(wrapped);
          }
        }
      )
    );
  }

  return () => {
    for (const unsub of unsubscribes) {
      unsub();
    }
  };
}

export async function commitStateDiffToFirestore(
  prevState: AppState,
  nextState: AppState,
  user: User,
  memberEmails: string[],
  metaCache: FirestoreMetaCache
): Promise<void> {
  const diff = computeStateDiffOps(prevState, nextState);
  if (diff.upserts.length === 0 && diff.deletes.length === 0 && !diff.updateSystemMeta) {
    return;
  }

  const normalizedEmails = computeMemberEmails(memberEmails, user.email);
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const nowServerTs = serverTimestamp();

  for (const op of diff.upserts) {
    const key = metaKey(op.collection, op.id);
    const cached = metaCache.get(key);
    const ownerUid = cached?.ownerUid || user.uid;
    const hasResolvedCreatedAt =
      Boolean(cached?.serverCreatedAt) &&
      typeof (cached?.serverCreatedAt as { toMillis?: unknown })?.toMillis === 'function';

    if (op.isCreate || !cached) {
      metaCache.set(key, {
        ownerUid,
        memberEmails: normalizedEmails,
        serverCreatedAt: nowServerTs,
      });
      operations.push((batch) => {
        batch.set(doc(db, op.collection, op.id), {
          ...op.data,
          ownerUid,
          memberEmails: normalizedEmails,
          serverCreatedAt: nowServerTs,
          serverUpdatedAt: nowServerTs,
        });
      });
    } else if (hasResolvedCreatedAt) {
      operations.push((batch) => {
        batch.set(doc(db, op.collection, op.id), {
          ...op.data,
          ownerUid,
          memberEmails: normalizedEmails,
          serverCreatedAt: cached.serverCreatedAt,
          serverUpdatedAt: nowServerTs,
        });
      });
    } else {
      operations.push((batch) => {
        batch.update(doc(db, op.collection, op.id), {
          ...op.data,
          ownerUid,
          memberEmails: normalizedEmails,
          serverUpdatedAt: nowServerTs,
        });
      });
    }
  }

  for (const del of diff.deletes) {
    metaCache.delete(metaKey(del.collection, del.id));
    operations.push((batch) => {
      batch.delete(doc(db, del.collection, del.id));
    });
  }

  if (diff.updateSystemMeta) {
    const sysCached = metaCache.get(metaKey('system', SYSTEM_META_DOC_ID));
    const sysOwner = sysCached?.ownerUid || user.uid;
    const sysCreated = sysCached?.serverCreatedAt || nowServerTs;
    operations.push((batch) => {
      batch.set(doc(db, 'system', SYSTEM_META_DOC_ID), {
        id: SYSTEM_META_DOC_ID,
        isSampleData: Boolean(nextState.isSampleData),
        seeded: true,
        ownerUid: sysOwner,
        memberEmails: normalizedEmails,
        serverCreatedAt: sysCreated,
        serverUpdatedAt: nowServerTs,
      });
    });
  }

  await commitOperationsInBatches(operations, OperationType.WRITE, 'workspace-sync');
}

export async function updateWorkspaceMemberEmails(
  nextMemberEmails: string[],
  currentState: AppState,
  user: User,
  metaCache: FirestoreMetaCache
): Promise<string[]> {
  const normalizedEmails = computeMemberEmails(nextMemberEmails, user.email);
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const nowServerTs = serverTimestamp();

  operations.push((batch) => {
    batch.update(doc(db, 'system', SYSTEM_META_DOC_ID), {
      memberEmails: normalizedEmails,
      serverUpdatedAt: nowServerTs,
    });
  });

  for (const col of BUSINESS_COLLECTIONS) {
    const list = currentState[col] as Array<{ id: string }>;
    for (const item of list) {
      const sanitized = sanitizeEntityForCollection(col, item);
      const id = String(sanitized.id);
      if (!metaCache.has(metaKey(col, id))) continue;
      operations.push((batch) => {
        batch.update(doc(db, col, id), {
          memberEmails: normalizedEmails,
          serverUpdatedAt: nowServerTs,
        });
      });
    }
  }

  await commitOperationsInBatches(operations, OperationType.UPDATE, 'workspace-member-emails');
  return normalizedEmails;
}
