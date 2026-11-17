import React, { useEffect, useRef, useState } from 'react';
import { Edit3, KeyRound, RotateCcw, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { getDefaultPinForAccount } from '../data/seedData';
import { UserAccount, UserRole } from '../types/erp';

interface AccountSettingsModalProps {
  open: boolean;
  currentUser: UserAccount;
  accounts: UserAccount[];
  hasSystemData?: boolean;
  onClose: () => void;
  onChangePin: (
    targetUserId: string,
    newPin: string,
    currentPinForSelf?: string
  ) => { ok: true } | { ok: false; error: string };
  onCreateAccount: (input: {
    name: string;
    username: string;
    role: UserRole;
    pin: string;
  }) => { ok: true } | { ok: false; error: string };
  onUpdateAccount: (
    targetUserId: string,
    input: { name: string; username: string; role: UserRole; pin?: string }
  ) => { ok: true } | { ok: false; error: string };
  onDeleteAccount: (targetUserId: string) => { ok: true } | { ok: false; error: string };
  onRequestResetSystem?: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  open,
  currentUser,
  accounts,
  hasSystemData = true,
  onClose,
  onChangePin,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onRequestResetSystem,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Change own PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin: create account
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Thành viên');
  const [newAccPin, setNewAccPin] = useState('');
  const [accMsg, setAccMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin: reset member PIN
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPinVal, setResetPinVal] = useState('');

  // Admin: edit & delete account
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccUsername, setEditAccUsername] = useState('');
  const [editAccRole, setEditAccRole] = useState<UserRole>('Thành viên');
  const [editAccPin, setEditAccPin] = useState('');
  const [deleteAccTarget, setDeleteAccTarget] = useState<UserAccount | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  const isAdmin = currentUser.role === 'Admin';
  const adminCount = accounts.filter((a) => a.role === 'Admin').length;

  const handleOwnPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (newPin.trim() !== confirmPin.trim()) {
      setPinMsg({ type: 'error', text: 'Mã PIN mới nhập lại không khớp.' });
      return;
    }
    const res = onChangePin(currentUser.id, newPin, currentPin);
    if (!res.ok) {
      setPinMsg({ type: 'error', text: res.error });
      return;
    }
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinMsg({ type: 'success', text: 'Đã cập nhật mã PIN mới của bạn và đồng bộ lên Firestore.' });
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAccMsg(null);
    const res = onCreateAccount({
      name: newName,
      username: newUsername,
      role: newRole,
      pin: newAccPin,
    });
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setNewName('');
    setNewUsername('');
    setNewRole('Thành viên');
    setNewAccPin('');
    setAccMsg({ type: 'success', text: 'Đã tạo tài khoản thành viên mới và đồng bộ Firestore.' });
  };

  const handleAdminResetPin = (targetId: string) => {
    setAccMsg(null);
    const res = onChangePin(targetId, resetPinVal);
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setResetTargetId(null);
    setResetPinVal('');
    setAccMsg({ type: 'success', text: 'Đã đặt lại mã PIN mới cho thành viên.' });
  };

  const handleResetToDefaultPin = (acc: UserAccount) => {
    setAccMsg(null);
    const defaultPin = getDefaultPinForAccount(acc);
    const res = onChangePin(acc.id, defaultPin);
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setResetTargetId(null);
    setResetPinVal('');
    setAccMsg({
      type: 'success',
      text: `Đã đặt lại mã PIN của ${acc.name} về mặc định (${defaultPin}).`,
    });
  };

  const openEditAccount = (acc: UserAccount) => {
    setAccMsg(null);
    setResetTargetId(null);
    setDeleteAccTarget(null);
    setEditAccId(acc.id);
    setEditAccName(acc.name);
    setEditAccUsername(acc.username);
    setEditAccRole(acc.role);
    setEditAccPin('');
  };

  const handleSaveEditAccount = (targetId: string) => {
    setAccMsg(null);
    const res = onUpdateAccount(targetId, {
      name: editAccName,
      username: editAccUsername,
      role: editAccRole,
      pin: editAccPin || undefined,
    });
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setEditAccId(null);
    setEditAccPin('');
    setAccMsg({ type: 'success', text: 'Đã cập nhật thông tin tài khoản thành viên.' });
  };

  const handleConfirmDeleteAccount = () => {
    if (!deleteAccTarget) return;
    setAccMsg(null);
    const res = onDeleteAccount(deleteAccTarget.id);
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      setDeleteAccTarget(null);
      return;
    }
    setDeleteAccTarget(null);
    setAccMsg({ type: 'success', text: 'Đã xóa tài khoản thành viên khỏi hệ thống.' });
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="account-settings-title"
      className="fixed inset-0 z-50 m-auto w-full max-w-2xl rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="max-h-[88vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="account-settings-title" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Cài đặt tài khoản &amp; Mã PIN
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Đang đăng nhập: <strong className="text-[#1A1F1E]">{currentUser.name}</strong> ·{' '}
              {currentUser.role === 'Admin' ? 'Admin / Quản lý' : 'Thành viên'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt tài khoản"
            className="rounded-lg p-1.5 text-[#57605E] transition-colors hover:bg-[#F3EFE6] hover:text-[#1A1F1E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section 1: Đổi mật khẩu / mã PIN cá nhân */}
        <section className="mt-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
            <KeyRound className="h-4 w-4 text-[#0D4F43]" />
            Đổi mã PIN 4 số của bạn
          </h3>

          {pinMsg && (
            <div
              role="status"
              className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                pinMsg.type === 'error'
                  ? 'border-[#A63429]/30 bg-[#A63429]/5 text-[#A63429]'
                  : 'border-[#0D4F43]/30 bg-[#0D4F43]/10 text-[#0D4F43]'
              }`}
            >
              {pinMsg.text}
            </div>
          )}

          <form onSubmit={handleOwnPinSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="self-pin-current" className="block text-xs font-medium text-[#57605E]">
                Mã PIN hiện tại
              </label>
              <input
                id="self-pin-current"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="self-pin-new" className="block text-xs font-medium text-[#57605E]">
                Mã PIN mới (4 số)
              </label>
              <input
                id="self-pin-new"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ví dụ: 5678"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="self-pin-confirm" className="block text-xs font-medium text-[#57605E]">
                Nhập lại mã PIN mới
              </label>
              <input
                id="self-pin-confirm"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32]"
              >
                Lưu mã PIN mới
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Quản lý tài khoản (Admin only) */}
        {isAdmin && (
          <section className="mt-6 border-t border-[#ECE7DD] pt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
              <ShieldCheck className="h-4 w-4 text-[#0D4F43]" />
              Quản lý tài khoản team &amp; Đặt lại PIN (Quyền Admin)
            </h3>

            {accMsg && (
              <div
                role="status"
                className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                  accMsg.type === 'error'
                    ? 'border-[#A63429]/30 bg-[#A63429]/5 text-[#A63429]'
                    : 'border-[#0D4F43]/30 bg-[#0D4F43]/10 text-[#0D4F43]'
                }`}
              >
                {accMsg.text}
              </div>
            )}

            {deleteAccTarget && (
              <div
                role="alertdialog"
                aria-label="Xác nhận xóa tài khoản"
                className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-3.5 py-2.5 text-xs"
              >
                <span className="font-medium text-[#A63429]">
                  Xác nhận xóa vĩnh viễn tài khoản <strong>{deleteAccTarget.name}</strong> ({deleteAccTarget.username})?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteAccTarget(null)}
                    className="rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteAccount}
                    className="rounded bg-[#A63429] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#8B2920]"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4DFD5] font-semibold text-[#57605E]">
                    <th className="py-2 pr-3">Thành viên</th>
                    <th className="py-2 px-3">Tên đăng nhập</th>
                    <th className="py-2 px-3">Vai trò</th>
                    <th className="py-2 pl-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DD]">
                  {accounts.map((acc) => {
                    const isSelf = acc.id === currentUser.id;
                    const isLastAdmin = acc.role === 'Admin' && adminCount <= 1;
                    const cannotDelete = isSelf || isLastAdmin;
                    const isEditingThis = editAccId === acc.id;
                    const defaultPin = getDefaultPinForAccount(acc);
                    return (
                      <React.Fragment key={acc.id}>
                        <tr>
                          <td className="py-2.5 pr-3 font-medium text-[#1A1F1E]">
                            {acc.name}
                            {isSelf && (
                              <span className="ml-1.5 text-[11px] font-normal text-[#0D4F43]">
                                (Bạn)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#57605E]">{acc.username}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={
                                acc.role === 'Admin'
                                  ? 'font-semibold text-[#0D4F43]'
                                  : 'text-[#57605E]'
                              }
                            >
                              {acc.role}
                            </span>
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            {resetTargetId === acc.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={4}
                                  aria-label={`Mã PIN mới cho ${acc.name}`}
                                  placeholder="PIN 4 số"
                                  value={resetPinVal}
                                  onChange={(e) =>
                                    setResetPinVal(e.target.value.replace(/\D/g, '').slice(0, 4))
                                  }
                                  className="w-24 rounded border border-[#E4DFD5] px-2 py-1 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAdminResetPin(acc.id)}
                                  className="rounded bg-[#0D4F43] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#093B32]"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetTargetId(null);
                                    setResetPinVal('');
                                  }}
                                  className="rounded border border-[#E4DFD5] px-2 py-1 text-xs text-[#57605E]"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditingThis ? setEditAccId(null) : openEditAccount(acc)
                                  }
                                  aria-label={`Sửa tài khoản ${acc.name}`}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditAccId(null);
                                    setResetTargetId(acc.id);
                                    setResetPinVal('');
                                  }}
                                  className="rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                                >
                                  Đổi PIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetToDefaultPin(acc)}
                                  title={`Đặt lại về PIN mặc định (${defaultPin})`}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/5"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  PIN mặc định ({defaultPin})
                                </button>
                                <button
                                  type="button"
                                  disabled={cannotDelete}
                                  onClick={() => setDeleteAccTarget(acc)}
                                  aria-label={`Xóa tài khoản ${acc.name}`}
                                  title={
                                    isSelf
                                      ? 'Không thể tự xóa tài khoản đang đăng nhập'
                                      : isLastAdmin
                                        ? 'Cần giữ ít nhất 1 Admin'
                                        : `Xóa tài khoản ${acc.name}`
                                  }
                                  className="rounded border border-[#E4DFD5] bg-white p-1 text-[#A63429] hover:border-[#A63429]/40 hover:bg-[#A63429]/5 disabled:opacity-30"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {isEditingThis && (
                          <tr className="bg-[#FAF8F4]">
                            <td colSpan={4} className="px-3 py-3">
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 sm:items-end">
                                <div>
                                  <label
                                    htmlFor={`edit-acc-name-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Tên hiển thị
                                  </label>
                                  <input
                                    id={`edit-acc-name-${acc.id}`}
                                    type="text"
                                    value={editAccName}
                                    onChange={(e) => setEditAccName(e.target.value)}
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-acc-user-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Tên đăng nhập
                                  </label>
                                  <input
                                    id={`edit-acc-user-${acc.id}`}
                                    type="text"
                                    value={editAccUsername}
                                    onChange={(e) => setEditAccUsername(e.target.value)}
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-acc-role-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Vai trò
                                  </label>
                                  <select
                                    id={`edit-acc-role-${acc.id}`}
                                    value={editAccRole}
                                    onChange={(e) => setEditAccRole(e.target.value as UserRole)}
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                  >
                                    <option value="Thành viên">Thành viên</option>
                                    <option value="Admin">Admin</option>
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-acc-pin-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    PIN mới (tùy chọn)
                                  </label>
                                  <input
                                    id={`edit-acc-pin-${acc.id}`}
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Giữ nguyên nếu trống"
                                    value={editAccPin}
                                    onChange={(e) =>
                                      setEditAccPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                                    }
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="mt-2.5 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditAccId(null)}
                                  className="rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#57605E]"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditAccount(acc.id)}
                                  className="rounded bg-[#0D4F43] px-3 py-1 text-xs font-medium text-white hover:bg-[#093B32]"
                                >
                                  Lưu tài khoản
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleCreateAccountSubmit}
              className="mt-4 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1F1E]">
                <UserPlus className="h-3.5 w-3.5 text-[#0D4F43]" />
                Tạo tài khoản thành viên mới
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="new-acc-name" className="block text-xs font-medium text-[#57605E]">
                    Tên thành viên
                  </label>
                  <input
                    id="new-acc-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Minh"
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-acc-user" className="block text-xs font-medium text-[#57605E]">
                    Tên đăng nhập
                  </label>
                  <input
                    id="new-acc-user"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ví dụ: minh"
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-acc-role" className="block text-xs font-medium text-[#57605E]">
                    Vai trò
                  </label>
                  <select
                    id="new-acc-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                  >
                    <option value="Thành viên">Thành viên</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="new-acc-pin" className="block text-xs font-medium text-[#57605E]">
                    Mã PIN 4 số
                  </label>
                  <input
                    id="new-acc-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newAccPin}
                    onChange={(e) => setNewAccPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="6666"
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-[#0D4F43] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#093B32]"
                >
                  Thêm tài khoản
                </button>
              </div>
            </form>

            {onRequestResetSystem && hasSystemData && (
              <div className="mt-6 border-t border-[#ECE7DD] pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A63429]/25 bg-[#A63429]/[0.04] p-4">
                  <div>
                    <div className="text-xs font-semibold text-[#A63429]">
                      Dữ liệu hệ thống &amp; Dữ liệu mẫu
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#57605E]">
                      Xóa sạch toàn bộ đơn hàng, tồn kho, cổ đông, chi phí, dự trù về 0 để bắt đầu nhập liệu thực tế (giữ nguyên tài khoản team).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestResetSystem();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#A63429] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#8B2920] whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa toàn bộ dữ liệu mẫu (Reset hệ thống về 0)
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </dialog>
  );
};
