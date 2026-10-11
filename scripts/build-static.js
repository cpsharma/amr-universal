const fs = require('fs');
const http = require('http');
const path = require('path');

const app = require('../src/app');
const config = require('../src/config');
const { seedIfEmpty } = require('../src/seed');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function outputPath(urlPath) {
  const safePath = path.posix.normalize(urlPath).replace(/^\/+/, '');
  if (safePath === '..' || safePath.startsWith('../')) {
    throw new Error(`Refusing to write URL outside the output directory: ${urlPath}`);
  }
  return path.join(OUTPUT_DIR, safePath, 'index.html');
}

async function main() {
  if (!process.env.BASE_URL) {
    throw new Error('Set BASE_URL to the final site origin before building the static website');
  }
  const siteUrl = new URL(config.BASE_URL);
  if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) {
    throw new Error('BASE_URL must be an http(s) origin without a path, query or fragment');
  }

  seedIfEmpty();

  const server = http.createServer(app);
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;

  try {
    const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
    if (!sitemapResponse.ok) throw new Error(`Sitemap request failed: ${sitemapResponse.status}`);
    const sitemap = await sitemapResponse.text();
    const pagePaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
      const url = new URL(match[1]);
      if (url.origin !== siteUrl.origin) throw new Error(`Unexpected sitemap origin: ${url.origin}`);
      if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {
        throw new Error(`Unexpected sitemap URL: ${url.href}`);
      }
      return url.pathname;
    });
    if (!pagePaths.includes('/')) throw new Error('Sitemap does not contain the home page');

    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const pagePath of pagePaths) {
      const response = await fetch(new URL(pagePath, origin));
      if (!response.ok) throw new Error(`Page request failed (${response.status}): ${pagePath}`);
      const html = await response.text();
      const staticHtml = html.replace(/<body(\s)/, '<body data-static-site="true"$1');
      const filePath = pagePath === '/' ? path.join(OUTPUT_DIR, 'index.html') : outputPath(pagePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, staticHtml);
    }

    for (const name of ['robots.txt', 'sitemap.xml']) {
      const response = await fetch(`${origin}/${name}`);
      if (!response.ok) throw new Error(`${name} request failed: ${response.status}`);
      fs.writeFileSync(path.join(OUTPUT_DIR, name), await response.text());
    }

    fs.writeFileSync(
      path.join(OUTPUT_DIR, '404.html'),
      await (await fetch(`${origin}/__static_export_not_found__`)).text()
    );
    fs.cpSync(PUBLIC_DIR, OUTPUT_DIR, { recursive: true });
    console.log(`[static] exported ${pagePaths.length} pages and public assets to dist/`);
  } finally {
    await close(server);
  }
}

main().catch((error) => {
  console.error('[static] export failed:', error);
  process.exitCode = 1;
});
