const API_BASE = 'https://api.football-data.org/v4';
const CACHE_SECONDS = 15;

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_m, c) => String.fromCodePoint(Number(c)));

const xmlValue = (item, tag) => decodeXml(item.match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i'))?.[1] || '').trim();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...headers } });

function sourcesFrom(metadata = {}) {
  return (metadata.groundingChunks || metadata.groundingSupports || [])
    .map((item) => item.web || item)
    .map((item) => ({ title: item.title || item.uri || 'Fonte', url: item.uri || item.url }))
    .filter((item) => /^https:\/\//.test(item.url))
    .slice(0, 5);
}

function parseGeminiJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function findBroadcast(url, env) {
  if (!env.GEMINI_API_KEY) return json({ status: 'unavailable', message: 'Busca inteligente ainda não foi configurada.' }, 503);
  const home = (url.searchParams.get('home') || '').slice(0, 80);
  const away = (url.searchParams.get('away') || '').slice(0, 80);
  const competition = (url.searchParams.get('competition') || '').slice(0, 100);
  const date = (url.searchParams.get('date') || '').slice(0, 30);
  if (!home || !away) return json({ error: 'Informe home e away.' }, 400);

  const prompt = `Pesquise na web onde assistir legalmente no BRASIL a partida ${home} x ${away}, competição ${competition}, data ${date}. Use apenas fonte oficial de emissora, streaming, clube ou competição. Não invente canais. Responda SOMENTE JSON: {"status":"confirmed" ou "pending","channels":["nome"],"note":"texto curto em português"}. Se não houver fonte clara, status deve ser pending e channels deve ser [].`;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
    });
    const data = await response.json();
    if (!response.ok) return json({ status: 'unavailable', message: 'Gemini respondeu ' + response.status }, 502);
    const candidate = data.candidates?.[0];
    const answer = parseGeminiJson(candidate?.content?.parts?.map((part) => part.text || '').join(''));
    const sources = sourcesFrom(candidate?.groundingMetadata);
    const channels = Array.isArray(answer?.channels) ? answer.channels.filter((item) => typeof item === 'string').slice(0, 8) : [];
    const confirmed = answer?.status === 'confirmed' && channels.length > 0 && sources.length > 0;
    return json({ status: confirmed ? 'confirmed' : 'pending', channels: confirmed ? channels : [], note: confirmed ? answer.note || 'Transmissão encontrada em fontes consultadas.' : 'Transmissão a confirmar.', sources });
  } catch (error) {
    return json({ status: 'unavailable', message: 'Falha ao consultar Gemini: ' + error.message }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' } });
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
    if (url.pathname === '/health') return json({ ok: true, service: 'GoalTask API' });
    if (url.pathname === '/where-to-watch') return findBroadcast(url, env);

    if (url.pathname === '/news') {
      const search = (url.searchParams.get('q') || 'futebol Brasil').slice(0, 160);
      const feeds = [
        { name: 'Google Notícias', url: `https://news.google.com/rss/search?q=${encodeURIComponent(search)}&hl=pt-BR&gl=BR&ceid=BR:pt-419` },
        { name: 'Bing Notícias', url: `https://www.bing.com/news/search?q=${encodeURIComponent(search)}&format=rss&setlang=pt-br` },
      ];
      for (const feed of feeds) {
        try {
          const upstream = await fetch(feed.url, { headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
          if (!upstream.ok) continue;
          const news = [...(await upstream.text()).matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 30).map((match, index) => {
            const item = match[1]; const rawTitle = xmlValue(item, 'title'); const parts = rawTitle.split(' - ');
            return { id: `${Date.parse(xmlValue(item, 'pubDate')) || Date.now()}-${index}`, title: parts.length > 1 ? parts.slice(0, -1).join(' - ') : rawTitle, source: xmlValue(item, 'source') || parts.at(-1) || 'Notícias', url: xmlValue(item, 'link'), publishedAt: xmlValue(item, 'pubDate') };
          }).filter((item) => item.title && /^https:\/\//.test(item.url));
          if (news.length) return json({ updatedAt: new Date().toISOString(), provider: feed.name, news }, 200, { 'cache-control': 'public, max-age=300' });
        } catch {}
      }
      return json({ error: 'Nenhuma fonte de notícias respondeu.' }, 502);
    }

    if (url.pathname !== '/matches') return json({ error: 'Rota não encontrada.' }, 404);
    if (!env.FOOTBALL_DATA_TOKEN) return json({ error: 'Servidor sem token configurado.' }, 503);
    const today = new Date(), from = new Date(today), to = new Date(today);
    from.setUTCDate(from.getUTCDate() - 1); to.setUTCDate(to.getUTCDate() + 4);
    const date = (value) => value.toISOString().slice(0, 10);
    try {
      const upstream = await fetch(`${API_BASE}/matches?dateFrom=${date(from)}&dateTo=${date(to)}`, { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_TOKEN } });
      const data = await upstream.json();
      if (!upstream.ok) return json({ error: `Provedor respondeu ${upstream.status}.` }, upstream.status);
      return json({ updatedAt: new Date().toISOString(), matches: data.matches || [] }, 200, { 'cache-control': 'public, max-age=15' });
    } catch (error) { return json({ error: 'Falha ao consultar placares: ' + error.message }, 502); }
  },
};