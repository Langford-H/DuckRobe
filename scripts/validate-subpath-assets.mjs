import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { build } from 'vite';
import { unzipSync } from 'fflate';
import { robotAssetUrl as nodeAssetUrl } from '../src/robot.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'public');
const manifestFile = path.join(publicRoot, 'robot/manifest.json');
const manifestBytes = await readFile(manifestFile);
const sourceManifest = JSON.parse(manifestBytes);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const directory = await mkdtemp(path.join(tmpdir(), 'duckrobe-subpath-assets-'));
const originalFetch = globalThis.fetch;
const OriginalRequest = globalThis.Request;
const originalProgressEvent = globalThis.ProgressEvent;
const originalParser = globalThis.DOMParser;
const originalSerializer = globalThis.XMLSerializer;
const requests = [];
let deploymentBase = '/';

// Serve only the chosen deployment prefix. A root /robot request on the
// Pages run must really fail rather than being hidden by an SPA fallback.
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  requests.push(pathname);
  const filename = path.resolve(publicRoot, decodeURIComponent(pathname.slice(deploymentBase.length)));
  if (!pathname.startsWith(deploymentBase) || !filename.startsWith(`${publicRoot}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(filename);
    response.writeHead(200, { 'Content-Type': filename.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  // Node requires absolute requests; browsers resolve these against the page
  // origin. This adapter preserves every path sent by the production modules.
  globalThis.Request = class extends OriginalRequest {
    constructor(input, options) {
      super(typeof input === 'string' ? new URL(input, origin) : input, options);
    }
  };
  globalThis.fetch = (input, options) => originalFetch(typeof input === 'string' ? new URL(input, origin) : input, options);
  globalThis.ProgressEvent = class { constructor(type, properties) { this.type = type; Object.assign(this, properties); } };
  globalThis.DOMParser = DOMParser;
  globalThis.XMLSerializer = XMLSerializer;
  assert.equal(nodeAssetUrl('/robot/source/LICENSE'), '/robot/source/LICENSE', 'Plain Node imports must retain root-relative paths.');

  let reference;
  for (const base of ['/', '/DuckRobe/']) {
    deploymentBase = base;
    requests.length = 0;
    const entryFile = path.join(directory, 'entry.mjs');
    await writeFile(entryFile, `export { loadRobot, robotAssetUrl } from ${JSON.stringify(path.join(projectRoot, 'src/robot.js'))};\nexport { buildExportBundle } from ${JSON.stringify(path.join(projectRoot, 'src/export.js'))};\nexport { OUTFITS } from ${JSON.stringify(path.join(projectRoot, 'src/outfits.js'))};`);
    const built = await build({
      configFile: false, root: projectRoot, base, logLevel: 'silent',
      build: { write: false, minify: false, lib: { entry: entryFile, formats: ['es'], fileName: 'assets-check' }, rollupOptions: { output: { inlineDynamicImports: true } } },
    });
    const outputs = Array.isArray(built) ? built.flatMap(result => result.output) : built.output;
    const code = outputs.find(output => output.type === 'chunk' && output.isEntry).code;
    const filename = path.join(directory, base === '/' ? 'root.mjs' : 'pages.mjs');
    await writeFile(filename, code);
    const { loadRobot, robotAssetUrl, buildExportBundle, OUTFITS } = await import(pathToFileURL(filename).href);
    const prefix = `${base}robot/`;
    assert.equal(robotAssetUrl('/robot/source/LICENSE'), `${prefix}source/LICENSE`);
    assert.equal(robotAssetUrl(`${prefix}source/LICENSE`), `${prefix}source/LICENSE`, 'Asset paths must not receive the base twice.');
    assert.equal(robotAssetUrl('robot/source/LICENSE'), `${prefix}source/LICENSE`);
    assert.equal(robotAssetUrl('https://example.com/robot/source/LICENSE'), 'https://example.com/robot/source/LICENSE');
    assert.equal(robotAssetUrl('//example.com/robot/source/LICENSE'), '//example.com/robot/source/LICENSE');

    const robot = await loadRobot();
    const { metadata } = robot;
    assert.equal(metadata.web.glbUrl, `${prefix}web/microduck.glb`);
    assert.equal(metadata.web.kinematicsUrl, `${prefix}web/kinematics.json`);
    assert.equal(metadata.native.xmlUrl, `${prefix}source/robot_allcollisions.xml`);
    assert.equal(metadata.native.meshBaseUrl, `${prefix}source/assets/`);
    assert.equal(metadata.native.licenseUrl, `${prefix}source/LICENSE`);
    assert.equal(metadata.mjcfUrl, metadata.native.xmlUrl);
    assert.equal(metadata.meshBaseUrl, metadata.native.meshBaseUrl);
    assert.deepEqual(metadata.files, sourceManifest.files, 'Source asset hashes and attribution must stay unchanged.');

    const options = { robot, selection: OUTFITS[0].selection, outfitName: 'Subpath regression', createArchive: base !== '/' };
    const bundle = await buildExportBundle(options);
    if (reference) {
      for (const [name, bytes] of Object.entries(reference.files)) {
        if (name === 'manifest.json') continue;
        assert.equal(digest(bundle.files[name]), digest(bytes), `Deployment base changed ZIP content ${name}.`);
      }
      const unpacked = unzipSync(bundle.bytes);
      assert.deepEqual(Object.keys(unpacked).sort(), Object.keys(bundle.files).sort());
      for (const [name, bytes] of Object.entries(bundle.files)) assert.equal(digest(unpacked[name]), digest(bytes));
      // Also cover callers that supply the unmodified source manifest rather
      // than loadRobot's already-resolved runtime metadata.
      const rawRobot = { ...robot, metadata: { ...metadata, native: sourceManifest.native } };
      const rawBundle = await buildExportBundle({ ...options, robot: rawRobot, createArchive: false });
      assert.equal(digest(rawBundle.files['microduck.xml']), digest(bundle.files['microduck.xml']));
      assert.equal(digest(rawBundle.files['microduck.urdf']), digest(bundle.files['microduck.urdf']));
    } else reference = bundle;
    assert(requests.every(url => url.startsWith(prefix)), `Asset requests escaped ${prefix}: ${requests.join(', ')}`);
    for (const file of sourceManifest.native.meshFiles) assert(requests.includes(`${prefix}source/assets/${file}`), `Missing native mesh fetch ${file}.`);
    assert(requests.includes(`${prefix}source/LICENSE`));
    console.log(`Passed ${base}: real robot loading and ${sourceManifest.native.meshFiles.length}-mesh export; ${requests.length} asset requests stay inside the deployment prefix.`);
  }
  assert.equal(digest(await readFile(manifestFile)), digest(manifestBytes), 'Source manifest was modified.');
  console.log('Root paths, Pages subpaths, Node fallback, URL idempotence and self-contained ZIP content passed.');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.Request = OriginalRequest;
  globalThis.ProgressEvent = originalProgressEvent;
  globalThis.DOMParser = originalParser;
  globalThis.XMLSerializer = originalSerializer;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
