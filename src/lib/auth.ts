export type UiMode = 'customer' | 'vendor' | 'admin' | 'master_admin';

export interface AuthUser {
  id: number;
  phone_number: string;
  full_name: string;
  email: string;
  profile_id: string;
  ui_mode: UiMode;
  avatar_url?: string;
  is_vendor: boolean;
  is_admin: boolean;
}

export const auth = {
  save(access: string, refresh: string, user: AuthUser) {
    localStorage.setItem('ns_access', access);
    localStorage.setItem('ns_refresh', refresh);
    localStorage.setItem('ns_user', JSON.stringify(user));
  },
  user(): AuthUser | null {
    const raw = localStorage.getItem('ns_user');
    return raw ? JSON.parse(raw) : null;
  },
  access: () => localStorage.getItem('ns_access'),
  isLoggedIn: () => !!localStorage.getItem('ns_access'),
  logout() {
    ['ns_access', 'ns_refresh', 'ns_user'].forEach((k) => localStorage.removeItem(k));
    window.location.href = '/auth/login';
  },
  redirectAfterLogin(mode: UiMode) {
    const map: Record<UiMode, string> = {
      customer: '/',
      vendor: '/vendor/dashboard',
      admin: '/admin/dashboard',
      master_admin: '/admin/dashboard',
    };
    window.location.href = map[mode] ?? '/';
  },
};
