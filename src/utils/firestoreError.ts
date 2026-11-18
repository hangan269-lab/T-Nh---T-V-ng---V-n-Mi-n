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
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

export function formatFirestoreErrorForUser(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const raw = error instanceof Error ? error.message : String(error);
  const combined = `${code} ${raw}`;

  if (
    combined.includes('auth/operation-not-allowed') ||
    combined.includes('CONFIGURATION_NOT_FOUND')
  ) {
    return 'Phương thức Đăng nhập Ẩn danh (Anonymous) chưa được bật trên Firebase Authentication. Vui lòng bật trong Firebase Console rồi bấm Thử lại.';
  }
  if (combined.includes('auth/admin-restricted-operation')) {
    return 'Dự án Firebase đang hạn chế đăng nhập ẩn danh (auth/admin-restricted-operation). Vui lòng kiểm tra cấu hình Firebase Authentication rồi thử lại.';
  }
  if (combined.includes('auth/network-request-failed')) {
    return 'Không thể kết nối máy chủ xác thực Firebase do mất mạng hoặc kết nối không ổn định. Vui lòng kiểm tra Internet rồi bấm Thử lại.';
  }
  if (combined.includes('auth/too-many-requests')) {
    return 'Hệ thống nhận quá nhiều yêu cầu xác thực liên tiếp. Vui lòng đợi vài giây rồi bấm Thử lại.';
  }
  if (combined.includes('auth/invalid-api-key') || combined.includes('auth/app-not-authorized')) {
    return 'Cấu hình Firebase Authentication chưa hợp lệ hoặc tên miền hiện tại chưa được cấp phép.';
  }
  if (combined.includes('Free daily read units per project')) {
    return 'Hệ thống đã chạm giới hạn lượt đọc miễn phí trong ngày của Firestore (Spark plan). Hạn mức sẽ tự động đặt lại vào ngày mai hoặc có thể nâng cấp gói Blaze trên Firebase Console.';
  }
  if (combined.includes('Quota exceeded')) {
    return 'Đã vượt quá hạn mức miễn phí Firestore trong ngày (Spark plan). Dữ liệu của bạn vẫn an toàn và hạn mức sẽ tự làm mới vào ngày mai.';
  }
  if (
    combined.includes('Missing or insufficient permissions') ||
    combined.includes('permission-denied')
  ) {
    return 'Quy tắc bảo mật Firestore (firestore.rules) đang từ chối thao tác này hoặc phiên xác thực ẩn danh chưa hợp lệ. Vui lòng thử kết nối lại.';
  }
  if (combined.includes('the client is offline') || combined.includes('unavailable')) {
    return 'Mất kết nối tới máy chủ Firebase Firestore. Vui lòng kiểm tra kết nối mạng rồi bấm Thử lại.';
  }
  return 'Không thể kết nối và đồng bộ dữ liệu lên Firebase. Vui lòng kiểm tra mạng và thử lại.';
}
