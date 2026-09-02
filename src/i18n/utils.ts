import { translations, DEFAULT_LANG, SUPPORTED_LANGS, type Lang, type TranslationKey } from './translations';

const LANG_COOKIE = 'ns_lang';

export function getLang(request: Request): Lang {
  // 1. Cookie preference (user explicitly chose)
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
  if (match) {
    const val = match[1].trim() as Lang;
    if (SUPPORTED_LANGS.includes(val)) return val;
  }

  // 2. Accept-Language header
  const accept = request.headers.get('accept-language') ?? '';
  for (const segment of accept.split(',')) {
    const code = segment.trim().split(/[-;]/)[0].toLowerCase() as Lang;
    if (SUPPORTED_LANGS.includes(code)) return code;
  }

  return DEFAULT_LANG;
}

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations[DEFAULT_LANG][key] ?? key;
}

export function setLangCookieScript(lang: Lang): string {
  return `document.cookie = '${LANG_COOKIE}=${lang};path=/;max-age=31536000;SameSite=Lax';`;
}
