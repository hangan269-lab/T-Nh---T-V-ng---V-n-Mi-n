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
import { createDefaultAccounts, getDefaultPinForAccount } from '../data/seedData';
import { db } from '../firebase';
import {
  AppBackupSnapshot,
  AppNotification,
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
  computeStateDiffOps,
  sanitizeEntityForCollection,
  SYSTEM_META_DOC_ID,
  WORKSPACE_ID,
} from './firestoreSanitize';

export interface FirestoreDocMeta {
  workspaceId: string;
  serverCreatedAt: unknown;
}

export type FirestoreMetaCache = Map<string, FirestoreDocMeta>;

function metaKey(col: string, id: string): string {
  return `${col}/${id}`;
}

function stripFirestoreMetaFields<T = Record<string, unknown>>(raw: Record<string, unknown>): T {
  const {
    workspaceId: _workspaceId,
    ownerUid: _ownerUid,
    memberEmails: _memberEmails,
    serverCreatedAt: _serverCreatedAt,
    serverUpdatedAt: _serverUpdatedAt,
    ...rest
  } = raw;
  return rest as T;
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

export async function ensureWorkspaceSeeded(metaCache: FirestoreMetaCache): Promise<void> {
  // Check system/meta document directly first
  let metaSnapExists = false;
  let metaHasWorkspaceId = false;

  try {
    const metaDocSnap = await getDocFromServer(doc(db, 'system', SYSTEM_META_DOC_ID));
    if (metaDocSnap.exists()) {
      metaSnapExists = true;
      const raw = metaDocSnap.data() as Record<string, unknown>;
      metaHasWorkspaceId = raw.workspaceId === WORKSPACE_ID;
      if (metaHasWorkspaceId) {
        metaCache.set(metaKey('system', SYSTEM_META_DOC_ID), {
          workspaceId: WORKSPACE_ID,
          serverCreatedAt: raw.serverCreatedAt,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `system/${SYSTEM_META_DOC_ID}`);
  }

  // If system/meta exists from the old schema (before workspaceId), migrate it + known default accounts
  if (metaSnapExists && !metaHasWorkspaceId) {
    const ts = serverTimestamp();
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
    try {
      const metaDocSnap = await getDocFromServer(doc(db, 'system', SYSTEM_META_DOC_ID));
      const rawMeta = (metaDocSnap.data() ?? {}) as Record<string, unknown>;
      ops.push((batch) => {
        batch.set(doc(db, 'system', SYSTEM_META_DOC_ID), {
          id: SYSTEM_META_DOC_ID,
          workspaceId: WORKSPACE_ID,
          isSampleData: Boolean(rawMeta.isSampleData),
          seeded: true,
          serverCreatedAt: rawMeta.serverCreatedAt ?? ts,
          serverUpdatedAt: ts,
        });
      });

      const defaultAccounts = createDefaultAccounts();
      for (const defAcc of defaultAccounts) {
        const accSnap = await getDocFromServer(doc(db, 'accounts', defAcc.id));
        if (accSnap.exists()) {
          const rawAcc = accSnap.data() as Record<string, unknown>;
          const cleaned = stripFirestoreMetaFields<UserAccount>(rawAcc);
          const migratedPin = cleaned.pin === '1234' ? getDefaultPinForAccount(cleaned) : cleaned.pin;
          const sanitized = sanitizeEntityForCollection('accounts', {
            ...cleaned,
            pin: migratedPin,
          });
          ops.push((batch) => {
            batch.set(doc(db, 'accounts', defAcc.id), {
              ...sanitized,
              workspaceId: WORKSPACE_ID,
              serverCreatedAt: rawAcc.serverCreatedAt ?? ts,
              serverUpdatedAt: ts,
            });
          });
        }
      }

      await commitOperationsInBatches(ops, OperationType.WRITE, 'workspace-migrate');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workspace-migrate');
    }
    return;
  }

  if (metaSnapExists && metaHasWorkspaceId) {
    // Also ensure default 5 accounts exist if collection was emptied externally
    try {
      const accSnap = await getDocsFromServer(
        query(collection(db, 'accounts'), where('workspaceId', '==', WORKSPACE_ID))
      );
      if (accSnap.empty) {
        const ts = serverTimestamp();
        const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
        for (const acc of createDefaultAccounts()) {
          const sanitized = sanitizeEntityForCollection('accounts', acc);
          ops.push((batch) => {
            batch.set(doc(db, 'accounts', acc.id), {
              ...sanitized,
              workspaceId: WORKSPACE_ID,
              serverCreatedAt: ts,
              serverUpdatedAt: ts,
            });
          });
        }
        await commitOperationsInBatches(ops, OperationType.CREATE, 'accounts-seed');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    }
    return;
  }

  // Also check if accounts already exist with workspaceId before seeding full sample data
  let accountsEmpty = true;
  try {
    const accSnap = await getDocsFromServer(
      query(collection(db, 'accounts'), where('workspaceId', '==', WORKSPACE_ID))
    );
    accountsEmpty = accSnap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'accounts');
  }

  if (!accountsEmpty) {
    const metaRef = doc(db, 'system', SYSTEM_META_DOC_ID);
    const ts = serverTimestamp();
    try {
      await setDoc(metaRef, {
        id: SYSTEM_META_DOC_ID,
        workspaceId: WORKSPACE_ID,
        isSampleData: false,
        seeded: true,
        serverCreatedAt: ts,
        serverUpdatedAt: ts,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `system/${SYSTEM_META_DOC_ID}`);
    }
    return;
  }

  // First-time seed: initialize default 5 team accounts (1111..5555) with empty business workspace
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const ts = serverTimestamp();

  operations.push((batch) => {
    const metaRef = doc(db, 'system', SYSTEM_META_DOC_ID);
    batch.set(metaRef, {
      id: SYSTEM_META_DOC_ID,
      workspaceId: WORKSPACE_ID,
      isSampleData: false,
      seeded: true,
      serverCreatedAt: ts,
      serverUpdatedAt: ts,
    });
  });

  for (const acc of createDefaultAccounts()) {
    const sanitized = sanitizeEntityForCollection('accounts', acc);
    const id = String(sanitized.id);
    metaCache.set(metaKey('accounts', id), {
      workspaceId: WORKSPACE_ID,
      serverCreatedAt: ts,
    });
    operations.push((batch) => {
      batch.set(doc(db, 'accounts', id), {
        ...sanitized,
        workspaceId: WORKSPACE_ID,
        serverCreatedAt: ts,
        serverUpdatedAt: ts,
      });
    });
  }

  await commitOperationsInBatches(operations, OperationType.CREATE, 'workspace-seed');
}

export interface RealtimeWorkspaceCallbacks {
  onStateChange: (nextState: AppState) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
}

export function subscribeWorkspaceRealtime(
  metaCache: FirestoreMetaCache,
  callbacks: RealtimeWorkspaceCallbacks
): Unsubscribe {
  const latestCollections: Record<BusinessCollectionName, unknown[]> = {
    products: [],
    stockImports: [],
    orders: [],
    shareholders: [],
    expenses: [],
    budgetItems: [],
    accounts: [],
    auditLogs: [],
    backups: [],
    chinaPartners: [],
    notifications: [],
  };

  let isSampleData = false;
  let appIcon = 'DiamondMoss';
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
    const sortedBackups = [...(latestCollections.backups as AppBackupSnapshot[])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
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
    const sortedChinaPartners = [...(latestCollections.chinaPartners as Array<{ name: string }>)].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const sortedNotifications = [...(latestCollections.notifications as AppNotification[])].sort(
      (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    const TEAM_ORDER: Record<string, number> = {
      ngan: 0,
      giang: 1,
      hoa: 2,
      phuong: 3,
      linh: 4,
    };
    const sortedAccounts = [...(latestCollections.accounts as UserAccount[])].sort((a, b) => {
      const rankA = TEAM_ORDER[a.username.toLowerCase()] ?? 99;
      const rankB = TEAM_ORDER[b.username.toLowerCase()] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const nextState: AppState = {
      products: sortedProducts,
      stockImports: sortedImports,
      orders: sortedOrders,
      shareholders: latestCollections.shareholders as Shareholder[],
      expenses: sortedExpenses,
      budgetItems: latestCollections.budgetItems as BudgetItem[],
      accounts: sortedAccounts,
      auditLogs: sortedLogs,
      backups: sortedBackups,
      chinaPartners: sortedChinaPartners as any,
      notifications: sortedNotifications,
      appIcon,
      isSampleData,
    };

    callbacks.onStateChange(nextState);

    if (!notifiedReady && readySet.size >= expectedCount) {
      notifiedReady = true;
      callbacks.onReady();
    }
  };

  const unsubscribes: Unsubscribe[] = [];

  const sysQuery = query(
    collection(db, 'system'),
    where('workspaceId', '==', WORKSPACE_ID)
  );
  unsubscribes.push(
    onSnapshot(
      sysQuery,
      (snapshot) => {
        const metaDoc = snapshot.docs.find((d) => d.id === SYSTEM_META_DOC_ID) ?? snapshot.docs[0];
        if (metaDoc) {
          const raw = metaDoc.data() as Record<string, unknown>;
          metaCache.set(metaKey('system', metaDoc.id), {
            workspaceId: WORKSPACE_ID,
            serverCreatedAt: raw.serverCreatedAt,
          });
          isSampleData = Boolean(raw.isSampleData);
          if (typeof raw.appIcon === 'string' && raw.appIcon.trim()) {
            appIcon = raw.appIcon === 'Sparkles' ? 'DiamondMoss' : raw.appIcon;
          }
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

  for (const col of BUSINESS_COLLECTIONS) {
    const colQuery = query(collection(db, col), where('workspaceId', '==', WORKSPACE_ID));
    unsubscribes.push(
      onSnapshot(
        colQuery,
        (snapshot) => {
          const items: unknown[] = [];
          for (const docSnap of snapshot.docs) {
            const raw = docSnap.data() as Record<string, unknown>;
            metaCache.set(metaKey(col, docSnap.id), {
              workspaceId: WORKSPACE_ID,
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
  metaCache: FirestoreMetaCache
): Promise<void> {
  const diff = computeStateDiffOps(prevState, nextState);
  if (diff.upserts.length === 0 && diff.deletes.length === 0 && !diff.updateSystemMeta) {
    return;
  }

  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const nowServerTs = serverTimestamp();

  for (const op of diff.upserts) {
    const key = metaKey(op.collection, op.id);
    const cached = metaCache.get(key);
    const hasResolvedCreatedAt =
      Boolean(cached?.serverCreatedAt) &&
      typeof (cached?.serverCreatedAt as { toMillis?: unknown })?.toMillis === 'function';

    if (op.isCreate || !cached) {
      metaCache.set(key, {
        workspaceId: WORKSPACE_ID,
        serverCreatedAt: nowServerTs,
      });
      operations.push((batch) => {
        batch.set(doc(db, op.collection, op.id), {
          ...op.data,
          workspaceId: WORKSPACE_ID,
          serverCreatedAt: nowServerTs,
          serverUpdatedAt: nowServerTs,
        });
      });
    } else if (hasResolvedCreatedAt) {
      operations.push((batch) => {
        batch.set(doc(db, op.collection, op.id), {
          ...op.data,
          workspaceId: WORKSPACE_ID,
          serverCreatedAt: cached.serverCreatedAt,
          serverUpdatedAt: nowServerTs,
        });
      });
    } else {
      operations.push((batch) => {
        batch.update(doc(db, op.collection, op.id), {
          ...op.data,
          workspaceId: WORKSPACE_ID,
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
    const sysCreated = sysCached?.serverCreatedAt || nowServerTs;
    operations.push((batch) => {
      batch.set(doc(db, 'system', SYSTEM_META_DOC_ID), {
        id: SYSTEM_META_DOC_ID,
        workspaceId: WORKSPACE_ID,
        isSampleData: Boolean(nextState.isSampleData),
        appIcon: nextState.appIcon || 'DiamondMoss',
        seeded: true,
        serverCreatedAt: sysCreated,
        serverUpdatedAt: nowServerTs,
      });
    });
  }

  await commitOperationsInBatches(operations, OperationType.WRITE, 'workspace-sync');
}
