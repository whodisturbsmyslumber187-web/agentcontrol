/*
  Lightweight smoke test with zero external dependencies.
  Usage:
    1) Start preview/dev server (default target: http://127.0.0.1:4173)
    2) npm run smoke
*/
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const routes = ['/', '/login', '/dashboard', '/settings', '/chat'];

let failed = false;

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const status = response.status;
    const ok = status >= 200 && status < 400;
    console.log(`ROUTE ${route} STATUS ${status}`);
    if (!ok) failed = true;

    if (route === '/' && ok) {
      const html = await response.text();
      if (!html.includes('id="root"')) {
        failed = true;
        console.log('ROOT_MARKUP_MISSING id="root"');
      }
    }
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ROUTE ${route} ERROR ${message}`);
  }
}

if (failed) {
  console.log('SMOKE_RESULT FAILED');
  process.exit(1);
}

console.log('SMOKE_RESULT OK');
