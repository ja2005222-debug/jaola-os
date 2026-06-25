function collectMatches(html: string, pattern: RegExp) {
  return Array.from(html.matchAll(pattern))
    .map((match) => match[1])
    .filter(Boolean)
    .slice(0, 80);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchAndAnalyzeSite(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'JAOLA-OS-SiteAnalyzer/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch site: ${response.status}`);
  }

  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || 'Untitled site';
  const texts = stripHtml(html).slice(0, 2000);
  const links = collectMatches(html, /<a[^>]+href=["']([^"']+)["']/gi);
  const images = collectMatches(html, /<img[^>]+src=["']([^"']+)["']/gi);

  return { url, title, texts, links, images, fullHtml: html };
}
