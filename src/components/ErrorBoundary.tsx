import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { formatFirestoreErrorForUser } from '../utils/firestoreError';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const friendlyMessage = formatFirestoreErrorForUser(this.state.error);

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-10 text-[#1A1F1E]">
        <div className="w-full max-w-lg rounded-2xl border border-[#E4DFD5] bg-white p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#A63429]/10 p-2.5 text-[#A63429]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Lỗi đồng bộ dữ liệu Firebase
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#57605E]">
                {friendlyMessage}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D4F43] px-4 py-2 text-sm font-medium text-white hover:bg-[#093B32]"
            >
              <RefreshCw className="h-4 w-4" />
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      </div>
    );
  }
}
