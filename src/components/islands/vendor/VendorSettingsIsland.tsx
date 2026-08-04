import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { auth } from '../../../lib/auth';
import { VendorAuthGuard } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface SettingsItem {
  icon: string; title: string; subtitle: string;
  href?: string; onClick?: () => void; danger?: boolean;
}

function SettingsRow({ icon, title, subtitle, href, onClick, danger }: SettingsItem) {
  const cls = `flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50 cursor-pointer ${danger ? 'hover:bg-red-50' : ''}`;
  const inner = (
    <>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${danger ? 'bg-red-50' : 'bg-navy/8'}`}
        style={{ background: danger ? undefined : 'rgba(28,46,74,0.08)' }}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${danger ? 'text-red-600' : 'text-navy'}`}>{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <span className="text-gray-300 text-lg">›</span>
    </>
  );
  if (href) return <a href={href} className={cls}>{inner}</a>;
  return <div onClick={onClick} className={cls}>{inner}</div>;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy">Change Password</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <div className="text-4xl mb-4">📱</div>
        <p className="text-sm font-semibold text-navy mb-2">Use the NearSpot App</p>
        <p className="text-sm text-gray-500 mb-5">
          NearSpot uses OTP-based login. To reset your access, please use the mobile app or contact support.
        </p>
        <a href="mailto:support@nearspot.in"
          className="block w-full py-2.5 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors mb-2">
          Contact Support
        </a>
        <Button onClick={onClose} variant="outline" className="w-full py-2.5 rounded-xl text-sm font-bold">
          Close
        </Button>
      </div>
    </div>
  );
}

function QrCodeModal({ storeId, storeName, onClose }: { storeId: string; storeName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const storeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/stores/${storeId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(storeUrl)}`;

  const copy = () => {
    navigator.clipboard.writeText(storeUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy">Store QR Code</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <p className="text-xs text-gray-400 mb-4">Customers scan this to view your store.</p>
        <img src={qrUrl} alt="Store QR" className="w-48 h-48 mx-auto rounded-xl border border-gray-100 mb-4" />
        <p className="text-xs font-mono text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2 break-all">{storeUrl}</p>
        <Button onClick={copy} variant="outline" className="px-6 py-2 rounded-xl text-sm font-bold">
          {copied ? '✅ Copied!' : '📋 Copy Store Link'}
        </Button>
      </div>
    </div>
  );
}

function ReferralModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy">Referral Program</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <div className="text-center py-4">
          <div className="text-5xl mb-4">🎁</div>
          <p className="text-sm font-semibold text-navy mb-2">Earn 100 pts per vendor referred</p>
          <p className="text-xs text-gray-400 mb-4">
            Share your referral code with other store owners. When they sign up and complete store setup, you both earn points.
          </p>
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 font-medium">
            Contact support@nearspot.in to get your vendor referral code.
          </div>
        </div>
        <Button onClick={onClose} variant="outline" className="w-full py-2.5 rounded-xl text-sm font-bold mt-4">OK</Button>
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy">About NearSpot</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <div className="py-4">
          <div className="text-5xl mb-3">🛒</div>
          <p className="font-bold text-navy mb-1">NearSpot</p>
          <p className="text-xs text-gray-400 mb-1">Version 1.0.0 (Web)</p>
          <p className="text-xs text-gray-500">Hyperlocal shopping — discover stores near you.</p>
          <p className="text-xs text-gray-400 mt-3">© 2024 NearSpot. All rights reserved.</p>
        </div>
        <Button onClick={onClose} variant="outline" className="w-full py-2.5 rounded-xl text-sm font-bold">OK</Button>
      </div>
    </div>
  );
}

function Inner() {
  const [showPw, setShowPw] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [websiteReqDone, setWebsiteReqDone] = useState(false);
  const [websiteReqErr, setWebsiteReqErr] = useState('');

  const websiteReqMut = useMutation({
    mutationFn: () => api.post('/stores/mine/website-request/', {}),
    onSuccess: () => { setWebsiteReqDone(true); setWebsiteReqErr(''); },
    onError: () => setWebsiteReqErr('Request failed. Please try again.'),
  });

  const { data: store } = useQuery({
    queryKey: ['vendor-store-settings'],
    queryFn: () => api.get('/stores/mine/').then(r => r.data),
  });

  const logout = () => {
    api.post('/auth/logout/').finally(() => {
      ['ns_access', 'ns_refresh', 'ns_user'].forEach(k => localStorage.removeItem(k));
      window.location.href = '/auth/login';
    });
  };

  const storeId = (store as any)?.id ?? '';
  const storeName = (store as any)?.name ?? 'My Store';
  const nearspotId = (auth.user() as any)?.profile_id ?? '';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-navy">Settings</h1>
      </div>

      {/* Store info header */}
      {store && (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-navy/10 flex items-center justify-center text-2xl font-bold text-navy shrink-0">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold text-navy">{storeName}</p>
            <p className="text-xs text-gray-400 capitalize">{(store as any)?.category}</p>
            {nearspotId && <p className="text-xs font-mono font-semibold" style={{ color: '#C8973A' }}>{nearspotId}</p>}
          </div>
          {(store as any)?.is_verified && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">✓ Verified</span>
          )}
        </div>
      )}

      {/* Store management */}
      <div className="card overflow-hidden">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-5 py-3 bg-gray-50 border-b border-gray-100">Store Management</p>
        <SettingsRow icon="🏪" title="Edit Store Profile" subtitle="Name, address, category, hours" href="/vendor/store-setup" />
        <SettingsRow icon="📱" title="Get QR Code" subtitle="Show store QR for customer payments" onClick={() => setShowQr(true)} />
        <SettingsRow icon="👥" title="Staff Members" subtitle="Manage your store team" href="/vendor/staff" />
        <SettingsRow icon="🏷️" title="Discount Codes" subtitle="Create and manage promo codes" href="/vendor/discount-codes" />
        <SettingsRow icon="🚫" title="Blocked Customers" subtitle="View and manage blocked customers" href="/vendor/blacklist" />
        <SettingsRow icon="🌐" title="Request Website" subtitle={websiteReqDone ? '✓ Request sent!' : websiteReqErr || 'Get a dedicated website for your store'} onClick={() => { if (!websiteReqDone) websiteReqMut.mutate(); }} />
      </div>

      {/* Account */}
      <div className="card overflow-hidden">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-5 py-3 bg-gray-50 border-b border-gray-100">Account</p>
        <SettingsRow icon="🔔" title="Notification Preferences" subtitle="Choose what alerts you receive" href="/vendor/notifications" />
        <SettingsRow icon="🔒" title="Change Password" subtitle="Update your account password" onClick={() => setShowPw(true)} />
        <SettingsRow icon="🎁" title="Referral Program" subtitle="Earn 100 pts per vendor referred" onClick={() => setShowReferral(true)} />
      </div>

      {/* Support */}
      <div className="card overflow-hidden">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-5 py-3 bg-gray-50 border-b border-gray-100">Help & Support</p>
        <SettingsRow icon="❓" title="Help Center" subtitle="FAQs and guides" onClick={() => window.open('mailto:support@nearspot.in', '_blank')} />
        <SettingsRow icon="💬" title="Contact Support" subtitle="Chat with our team" onClick={() => window.open('mailto:support@nearspot.in', '_blank')} />
        <SettingsRow icon="ℹ️" title="About NearSpot" subtitle="Version 1.0.0 (Web)" onClick={() => setShowAbout(true)} />
      </div>

      {/* Danger */}
      <div className="card overflow-hidden">
        <SettingsRow icon="🚪" title="Sign Out" subtitle="Sign out of your account" onClick={() => setShowLogout(true)} danger />
      </div>

      {/* Modals */}
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
      {showQr && storeId && <QrCodeModal storeId={storeId} storeName={storeName} onClose={() => setShowQr(false)} />}
      {showReferral && <ReferralModal onClose={() => setShowReferral(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Logout confirm */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-navy mb-2">Sign Out?</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to sign out of your account?</p>
            <div className="flex gap-2">
              <Button onClick={logout} variant="destructive" className="flex-1 py-2.5 rounded-xl text-sm font-bold">Sign Out</Button>
              <Button onClick={() => setShowLogout(false)} variant="outline" className="flex-1 py-2.5 rounded-xl text-sm font-bold">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorSettingsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
