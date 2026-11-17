import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

export function formatFirestoreErrorForUser(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("Free daily read units per project")) {
    return 'Hệ thống đã chạm giới hạn lượt đọc miễn phí trong ngày của Firestore (Spark plan). Hạn mức sẽ tự động đặt lại vào ngày mai hoặc có thể nâng cấp gói Blaze trên Firebase Console.';
  }
  if (raw.includes('Quota exceeded')) {
    return 'Đã vượt quá hạn mức miễn phí Firestore trong ngày (Spark plan). Dữ liệu của bạn vẫn an toàn và hạn mức sẽ tự làm mới vào ngày mai.';
  }
  if (raw.includes('Missing or insufficient permissions') || raw.includes('permission-denied')) {
    return 'Tài khoản Google hiện tại chưa được cấp quyền truy cập dữ liệu Studio hoặc phiên xác thực chưa hợp lệ.';
  }
  if (raw.includes('the client is offline') || raw.includes('unavailable')) {
    return 'Mất kết nối tới máy chủ Firebase Firestore. Vui lòng kiểm tra kết nối mạng.';
  }
  return 'Không thể đồng bộ dữ liệu lên Firebase Firestore. Vui lòng thử lại.';
}
