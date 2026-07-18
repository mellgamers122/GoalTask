const API_BASE = 'https://api.football-data.org/v4';
const CACHE_SECONDS = 15;

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const xmlValue = (item, tag) => decodeXml(item.match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i'))?.[1] || '').trim();

export function parseNews(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 30).map((match, index) => {
    const item = match[1];
    const rawTitle = xmlValue(item, 'title');
    const parts = rawTitle.split(' - ');
    const source = xmlValue(item, 'source') || (parts.length > 1 ? parts.at(-1) : 'Notícias');
    const title = parts.length > 1 ? parts.slice(0, -1).join(' - ') : rawTitle;
    const rawUrl = xmlValue(item, 'link');
    const url = rawUrl.replace(/^http:\/\/www\.bing\.com\//i, 'https://www.bing.com/');
    return {
      id: `${Date.parse(xmlValue(item, 'pubDate')) || Date.now()}-${index}`,
      title,
      source,
      url,
      publishedAt: xmlValue(item, 'pubDate'),
    };
  }).filter((item) => item.title && /^https:\/\//i.test(item.url));
}

const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': `public, max-age=${CACHE_SECONDS}`,
    ...extraHeaders,
  },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' } });
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
    if (url.pathname === '/health') return json({ ok: true, service: 'GoalTask API' });
    if (url.pathname === '/news') {
      const search = (url.searchParams.get('q') || 'futebol Brasil').slice(0, 160);
      const feeds = [
        { name: 'Google Notícias', url: `https://news.google.com/rss/search?q=${encodeURIComponent(search)}&hl=pt-BR&gl=BR&ceid=BR:pt-419` },
        { name: 'Bing Notícias', url: `https://www.bing.com/news/search?q=${encodeURIComponent(search)}&format=rss&setlang=pt-br` },
      ];
      const cacheKey = new Request(`${url.origin}/news?q=${encodeURIComponent(search)}`, request);
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return new Response(cached.body, cached);
      const failures = [];
      for (const feed of feeds) {
        try {
          const upstream = await fetch(feed.url, {
            headers: {
              accept: 'application/rss+xml, application/xml, text/xml',
              'user-agent': 'Mozilla/5.0 (compatible; GoalTask/0.8; +https://github.com/mellgamers122/GoalTask)',
            },
          });
          if (!upstream.ok) {
            failures.push(`${feed.name}: HTTP ${upstream.status}`);
            continue;
          }
          const news = parseNews(await upstream.text());
          if (!news.length) {
            failures.push(`${feed.name}: feed vazio`);
            continue;
          }
          const response = json({ updatedAt: new Date().toISOString(), provider: feed.name, news }, 200, { 'cache-control': 'public, max-age=300' });
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
          return response;
        } catch (error) {
          failures.push(`${feed.name}: ${error.message}`);
        }
      }
      return json({ error: 'Nenhuma fonte de notícias respondeu.', details: failures }, 502, { 'cache-control': 'no-store' });
    }
    if (url.pathname !== '/matches') return json({ error: 'Rota não encontrada.' }, 404);
    if (!env.FOOTBALL_DATA_TOKEN) return json({ error: 'Servidor sem token configurado.' }, 503);

    const today = new Date();
    const from = new Date(today);
    const to = new Date(today);
    from.setUTCDate(from.getUTCDate() - 1);
    to.setUTCDate(to.getUTCDate() + 4);
    const date = (value) => value.toISOString().slice(0, 10);
    const cacheUrl = new URL(url.origin + '/matches');
    cacheUrl.searchParams.set('dateFrom', date(from));
    cacheUrl.searchParams.set('dateTo', date(to));
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(cached.body, cached);

    try {
      const upstream = await fetch(`${API_BASE}/matches?dateFrom=${date(from)}&dateTo=${date(to)}`, {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_TOKEN },
      });
      const data = await upstream.json();
      if (!upstream.ok) return json({ error: `Provedor respondeu ${upstream.status}.` }, upstream.status);
      const response = json({
        updatedAt: new Date().toISOString(),
        matches: data.matches || [],
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return json({ error: `Falha ao consultar placares: ${error.message}` }, 502);
    }
  },
};
