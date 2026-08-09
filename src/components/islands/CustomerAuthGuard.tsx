import { useEffect, useState } from 'react';
import { auth } from '../../lib/auth';

export function CustomerAuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'redirect'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('ns_access');
    const user  = auth.user();

    if (!token || !user) {
      window.location.href = '/auth/login';
      setStatus('redirect');
      return;
    }

    // Any logged-in user (customer, vendor, admin) can access customer pages.
    // Role-based navigation (which links appear in the navbar) is handled in Navbar.astro.
    setStatus('ok');
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'redirect') return null;

  return <>{children}</>;
}
