import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const publicDirectory = resolve(projectRoot, 'public');
const manifestPath = resolve(publicDirectory, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

async function assertPngSize(path, expectedSize) {
  const iconBuffer = await readFile(path);

  assert.equal(iconBuffer.toString('ascii', 1, 4), 'PNG');
  assert.equal(iconBuffer.readUInt32BE(16), expectedSize);
  assert.equal(iconBuffer.readUInt32BE(20), expectedSize);
}

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.ok(manifest.name);
assert.ok(manifest.short_name);

const expectedIcons = new Map([
  ['192x192', 192],
  ['512x512', 512],
]);

for (const [declaredSize, expectedSize] of expectedIcons) {
  const icon = manifest.icons.find(
    (candidate) =>
      candidate.sizes === declaredSize && candidate.purpose.includes('any'),
  );
  assert.ok(icon, `Icône ${declaredSize} absente du manifest`);

  await assertPngSize(resolve(publicDirectory, icon.src), expectedSize);
}

const maskableIcon = manifest.icons.find(
  (icon) => icon.sizes === '512x512' && icon.purpose.includes('maskable'),
);
assert.ok(maskableIcon, 'Icône maskable 512x512 absente du manifest');
await assertPngSize(resolve(publicDirectory, maskableIcon.src), 512);
await assertPngSize(
  resolve(publicDirectory, 'icons/apple-touch-icon.png'),
  180,
);
await readFile(resolve(publicDirectory, 'sw.js'));
await readFile(resolve(publicDirectory, 'offline.html'));

console.log('Manifest, icônes et fichiers PWA valides.');
