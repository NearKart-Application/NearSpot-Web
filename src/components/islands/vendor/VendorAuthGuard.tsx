import { useEffect, useState, useCallback } from 'react';
import { auth } from '../../../lib/auth';
import { Button } from '@/components/ui/button';

const VENDOR_INACTIVITY_MS = 60 * 60 * 1000; // 60 minutes
const VENDOR_WARNING_MS    = 55 * 60 * 1000; // warn at 55 minutes

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
      {refetch && <Button onClick={refetch} className="mt-2">Retry</Button>}
    </div>
  );
}

export function useVendorAuth() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'unauthenticated'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('ns_access');
    const user  = auth.user();
    if (!token || !user) { setStatus('unauthenticated'); return; }

    const role = user.ui_mode ?? (user as any).role ?? '';
    if (role === 'admin' || role === 'master_admin') {
      window.location.href = '/admin/dashboard';
      setStatus('unauthenticated');
      return;
    }
    if (role === 'customer' || (role !== 'vendor' && !user.is_vendor)) {
      window.location.href = '/';
      setStatus('unauthenticated');
      return;
    }
    setStatus('ok');
  }, []);

  return status;
}

export function VendorAuthGuard({ children }: { children: React.ReactNode }) {
  const status                        = useVendorAuth();
  const [showWarning, setShowWarning] = useState(false);

  const resetTimers = useCallback(() => {
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (status !== 'ok') return;

    let warnTimer:   ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      setShowWarning(false);
      warnTimer   = setTimeout(() => setShowWarning(true),           VENDOR_WARNING_MS);
      logoutTimer = setTimeout(() => { auth.logout(); window.location.href = '/auth/login'; }, VENDOR_INACTIVITY_MS);
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(ev => document.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      events.forEach(ev => document.removeEventListener(ev, reset));
    };
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-4xl mb-3">⏱️</div>
            <h3 className="text-lg font-bold text-navy mb-2">Session Expiring Soon</h3>
            <p className="text-sm text-gray-500 mb-6">
              You will be logged out in <strong>5 minutes</strong> due to inactivity.
            </p>
            <Button onClick={resetTimers} className="w-full py-3 text-sm font-bold">
              I'm still here
            </Button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
