import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = path.resolve(argument('out') || path.join(root, 'public/brand/cover.png'));
const looks = (argument('looks') || 'harbour-day,butter-walk,sunday-linen').split(',');
assert.equal(looks.length, 3, 'Choose three complete looks.');
const server = await createServer({ root, configFile: false, base: '/', logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 3840, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(`http://127.0.0.1:${port}/scripts/brand-render.html?looks=${encodeURIComponent(looks.join(','))}`);
  await page.waitForFunction(() => window.brandRender?.ready, null, { timeout: 60000 });
  const metadata = await page.evaluate(() => window.brandRender);
  assert.deepEqual(metadata.ducks.map(duck => duck.look), looks);
  assert.equal(metadata.robotMeshes, 210, 'Cover must include all 70 native visual instances of each of the three robots.');
  assert(metadata.ducks.every(duck => duck.robotMeshes === 70));
  assert.equal(errors.length, 0, errors.join('\n'));
  await mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, type: 'png', timeout: 60000 });
  const report = { method: 'Native Three.js/WebGL render with vector logo and local-font typography. No image generation or image editing.', width: 3840, height: 1920, ...metadata, errors };
  const reportPath = argument('report');
  if (reportPath) { await mkdir(path.dirname(path.resolve(reportPath)), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify({ output, ...report }, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
