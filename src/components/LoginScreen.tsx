import React, { useEffect, useState } from 'react';
import { Cloud, KeyRound, Loader2, Lock, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { UserAccount } from '../types/erp';

interface LoginScreenProps {
  accounts: UserAccount[];
  authReady: boolean;
  firebaseUserEmail: string | null;
  firestoreLoading: boolean;
  googleAuthError: string | null;
  isSigningInGoogle: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onLogin: (identifier: string, pin: string) => { ok: true } | { ok: false; error: string };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  accounts,
  authReady,
  firebaseUserEmail,
  firestoreLoading,
  googleAuthError,
  isSigningInGoogle,
  onGoogleSignIn,
  onGoogleSignOut,
  onLogin,
}) => {
  const [identifier, setIdentifier] = useState(accounts[0]?.username ?? 'ngan');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.username === identifier || a.name === identifier)) {
      setIdentifier(accounts[0].username);
    }
  }, [accounts, identifier]);

  const selectedAccount = accounts.find(
    (a) =>
      a.username.toLowerCase() === identifier.trim().toLowerCase() ||
      a.name.toLowerCase() === identifier.trim().toLowerCase()
  );

  const handleSelectAccount = (account: UserAccount) => {
    setIdentifier(account.username);
    setError(null);
    const pinInput = document.getElementById('login-pin');
    if (pinInput) {
      pinInput.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = onLogin(identifier, pin);
    if (!result.ok) {
      setError(result.error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-10 text-[#1A1F1E]">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-[#E4DFD5] bg-white lg:grid-cols-12">
        {/* Left column: Brand & Team Context */}
        <div className="flex flex-col justify-between border-b border-[#ECE7DD] bg-[#F6F2EA] p-8 lg:col-span-5 lg:border-b-0 lg:border-r">
          <div>
            <div className="font-serif text-2xl font-bold tracking-tight text-[#1A1F1E]">
              Tơ Nhã · Tơ Vương
            </div>
            <div className="mt-1 text-sm font-medium text-[#0D4F43]">&amp; Vân Miên Studio</div>
            <p className="mt-6 text-sm leading-relaxed text-[#57605E]">
              Hệ thống quản lý bán hàng, tồn kho, tài chính và nhật ký thao tác đồng bộ thời gian thực trên Cloud Firestore cho đội ngũ 3 thương hiệu.
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-[#E4DFD5] pt-6 text-xs text-[#57605E]">
            <div className="flex items-start gap-2.5">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
              <span>
                Đồng bộ đa thiết bị thời gian thực qua <strong className="text-[#1A1F1E]">Firebase Firestore</strong> (Đơn hàng, Kho, Nhập kho, Thu Chi, Quỹ, Dự trù, Nhật ký).
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
              <span>
                Tự động ghi nhận <strong className="text-[#1A1F1E]">Người tạo đơn</strong> và{' '}
                <strong className="text-[#1A1F1E]">Người xác nhận thanh toán</strong>.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
              <span>
                Phân quyền rõ ràng giữa <strong className="text-[#1A1F1E]">Admin (Ngân)</strong> và{' '}
                <strong className="text-[#1A1F1E]">Thành viên</strong>; bảo mật theo tài khoản Google.
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Cloud Auth + Team PIN Form */}
        <div className="p-8 lg:col-span-7">
          {!authReady ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0D4F43]" />
              <p className="mt-3 text-sm font-medium text-[#1A1F1E]">
                Đang kiểm tra phiên đăng nhập Firebase...
              </p>
            </div>
          ) : !firebaseUserEmail ? (
            <div className="flex min-h-[320px] flex-col justify-center">
              <h1 className="font-serif text-2xl font-semibold text-[#1A1F1E]">
                Kết nối dữ liệu Cloud Firestore
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#57605E]">
                Đăng nhập bằng tài khoản Google để kết nối và đồng bộ dữ liệu thời gian thực giữa các thiết bị của studio.
              </p>

              {googleAuthError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-4 py-3 text-sm font-medium text-[#A63429]"
                >
                  {googleAuthError}
                </div>
              )}

              <button
                type="button"
                disabled={isSigningInGoogle}
                onClick={onGoogleSignIn}
                className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#0D4F43] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#093B32] disabled:opacity-60"
              >
                {isSigningInGoogle ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang mở cửa sổ đăng nhập Google...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4" />
                    Đăng nhập Google để kết nối Firestore
                  </>
                )}
              </button>

              <p className="mt-4 text-xs leading-relaxed text-[#57605E]">
                Sau khi kết nối Google thành công, hệ thống sẽ tải toàn bộ danh sách thành viên (Ngân, Giang, Hoa, Phương, Linh) và dữ liệu trực tiếp từ Firestore.
              </p>
            </div>
          ) : firestoreLoading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0D4F43]" />
              <p className="mt-3 text-sm font-medium text-[#1A1F1E]">
                Đang đồng bộ dữ liệu thời gian thực từ Firestore...
              </p>
              <p className="mt-1 text-xs text-[#57605E]">
                Tài khoản Google: <strong className="text-[#1A1F1E]">{firebaseUserEmail}</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] px-3.5 py-2 text-xs">
                <div className="text-[#57605E]">
                  Cloud: <strong className="font-medium text-[#0D4F43]">{firebaseUserEmail}</strong>
                </div>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  className="inline-flex items-center gap-1 font-medium text-[#A63429] hover:underline"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Đổi tài khoản Google
                </button>
              </div>

              <h1 className="mt-5 font-serif text-2xl font-semibold text-[#1A1F1E]">
                Đăng nhập thành viên
              </h1>
              <p className="mt-1 text-sm text-[#57605E]">
                Chọn tài khoản thành viên hoặc nhập tên đăng nhập và mã PIN để bắt đầu ca làm việc.
              </p>

              {/* Quick-select member buttons */}
              <div className="mt-5">
                <div className="text-xs font-medium text-[#57605E]">Chọn nhanh tài khoản thành viên</div>
                <div
                  role="group"
                  aria-label="Danh sách tài khoản thành viên"
                  className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {accounts.map((acc) => {
                    const isSelected = selectedAccount?.id === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectAccount(acc)}
                        className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-[#0D4F43] bg-[#0D4F43]/5 text-[#0D4F43]'
                            : 'border-[#E4DFD5] bg-white text-[#1A1F1E] hover:bg-[#FAF8F4]'
                        }`}
                      >
                        <span className="text-sm font-semibold">{acc.name}</span>
                        <span className="text-[11px] text-[#57605E]">
                          {acc.role === 'Admin' ? 'Admin / Quản lý' : 'Thành viên'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-4 py-2.5 text-sm font-medium text-[#A63429]"
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="login-identifier" className="block text-xs font-medium text-[#57605E]">
                    Tên đăng nhập hoặc Tên tài khoản
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ví dụ: ngan, giang, hoa, phuong, linh"
                    className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2.5 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="login-pin" className="block text-xs font-medium text-[#57605E]">
                    Mật khẩu / Mã PIN 4 số
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#57605E]" />
                    <input
                      id="login-pin"
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setError(null);
                      }}
                      placeholder="Nhập mã PIN (mặc định: 1234)"
                      className="w-full rounded-lg border border-[#E4DFD5] bg-white py-2.5 pl-9 pr-3 font-mono text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D4F43] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#093B32]"
                >
                  <KeyRound className="h-4 w-4" />
                  Đăng nhập{selectedAccount ? ` với tên ${selectedAccount.name}` : ''}
                </button>

                <p className="text-xs text-[#57605E]">
                  Mã PIN mặc định cho 5 tài khoản khởi tạo là <span className="font-mono font-semibold text-[#1A1F1E]">1234</span>. Thành viên có thể đổi mã PIN riêng trong mục Cài đặt tài khoản sau khi đăng nhập.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
