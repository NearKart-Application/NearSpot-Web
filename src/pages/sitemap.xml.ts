import type { APIRoute } from 'astro';

const ORIGIN = 'https://nearspot.in';

const STATIC_PAGES = [
  { url: '/',          changefreq: 'daily',   priority: '1.0' },
  { url: '/search',    changefreq: 'daily',   priority: '0.8' },
  { url: '/map',       changefreq: 'weekly',  priority: '0.7' },
  { url: '/about',     changefreq: 'monthly', priority: '0.5' },
  { url: '/terms',     changefreq: 'monthly', priority: '0.4' },
  { url: '/privacy',   changefreq: 'monthly', priority: '0.4' },
  { url: '/video',     changefreq: 'daily',   priority: '0.7' },
];

function urlEntry(loc: string, changefreq: string, priority: string, lastmod?: string) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n');
}

export const GET: APIRoute = async ({ request }) => {
  const base = (import.meta.env.API_BASE as string | undefined)
    ?? (process.env.API_BASE ?? 'http://localhost:8000/api/v1');

  // Fetch active stores for dynamic store pages
  let stores: { id: string; updated_at?: string }[] = [];
  try {
    const r = await fetch(`${base}/stores/?is_active=true&page_size=500`);
    if (r.ok) {
      const data = await r.json();
      stores = Array.isArray(data) ? data : (data.results ?? []);
    }
  } catch {}

  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    ...STATIC_PAGES.map(p => urlEntry(`${ORIGIN}${p.url}`, p.changefreq, p.priority, today)),
    ...stores.map(s => {
      const lastmod = s.updated_at ? s.updated_at.slice(0, 10) : today;
      return urlEntry(`${ORIGIN}/stores/${s.id}`, 'weekly', '0.8', lastmod);
    }),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
