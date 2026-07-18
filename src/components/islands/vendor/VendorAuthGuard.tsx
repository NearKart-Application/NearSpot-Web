import { useEffect, useState } from 'react';
import { auth } from '../../../lib/auth';

export function IslandError({ error, refetch }: { error: unknown; refetch?: () => void }) {
  const msg = (error as any)?.response?.data?.detail ?? (error as any)?.response?.data?.message ?? (error as any)?.message ?? 'Something went wrong';
  const status = (error as any)?.response?.status;
  return (
    <div className="card p-10 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="font-bold text-navy mb-1">Failed to load data</p>
      <p className="text-sm text-gray-500 mb-1">{msg}</p>
      {status && <p className="text-xs text-gray-400 mb-1">HTTP {status}</p>}
      {status === 401 && (
        <p className="text-sm text-red-500 mb-3">Session expired. <a href="/auth/login" className="underline font-bold">Log in again</a>.</p>
      )}
      {refetch && <button onClick={refetch} className="btn-primary mt-2 px-6 py-2.5 rounded-xl text-sm font-bold">Retry</button>}
    </div>
  );
}

export function useVendorAuth() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'unauthenticated'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('ns_access');
    const user = auth.user();
    if (!token || !user || (user.ui_mode !== 'vendor' && !user.is_vendor)) {
      setStatus('unauthenticated');
    } else {
      setStatus('ok');
    }
  }, []);

  return status;
}

export function VendorAuthGuard({ children }: { children: React.ReactNode }) {
  const status = useVendorAuth();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-navy mb-2">Please log in</h2>
        <p className="text-gray-400 text-sm mb-6">You need to be logged in as a vendor to access this page.</p>
        <a href="/auth/login" className="btn-primary px-8 py-3 rounded-xl font-bold">Log In</a>
      </div>
    );
  }

  return <>{children}</>;
}
