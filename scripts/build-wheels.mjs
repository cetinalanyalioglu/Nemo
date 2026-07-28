/**
 * Rebuilds the wheels the Python console installs, from a checkout of the package.
 *
 *     npm run wheels -- ../Nefes
 *
 * The console installs whatever `public/wheels/manifest.json` lists, so this builds the
 * wheel, drops it beside the manifest, removes the version it replaces, and rewrites the
 * manifest to name it. The wheel is committed: the app is served as static files, and a
 * deploy has no way to build one.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WHEEL_DIR = resolve(fileURLToPath(new URL('../public/wheels', import.meta.url)));
const MANIFEST = join(WHEEL_DIR, 'manifest.json');
const COMMENT =
  'Wheels the Python console installs, in order, on top of the base interpreter. ' +
  'Paths are relative to this file. Refresh with: npm run wheels -- <path-to-nefes-checkout>';

const source = process.argv[2];
if (!source) {
  console.error('usage: npm run wheels -- <path-to-nefes-checkout>');
  process.exit(1);
}

const python = process.env.PYTHON ?? 'python3';
const staging = mkdtempSync(join(tmpdir(), 'nemo-wheels-'));

try {
  console.log(`building a wheel from ${resolve(source)}`);
  execFileSync(python, ['-m', 'pip', 'wheel', resolve(source), '--no-deps', '-w', staging], {
    stdio: 'inherit',
  });

  const built = readdirSync(staging).filter((name) => name.endsWith('.whl'));
  if (built.length === 0) throw new Error('the build produced no wheel');

  // Only wheels of the packages just built are cleared, so a manifest listing several
  // packages keeps the ones this run did not rebuild.
  const rebuilt = new Set(built.map((name) => name.split('-')[0]));
  for (const existing of readdirSync(WHEEL_DIR)) {
    if (existing.endsWith('.whl') && rebuilt.has(existing.split('-')[0])) {
      rmSync(join(WHEEL_DIR, existing));
    }
  }

  for (const name of built) {
    copyFileSync(join(staging, name), join(WHEEL_DIR, name));
    console.log(`  ${name}`);
  }

  const wheels = readdirSync(WHEEL_DIR)
    .filter((name) => name.endsWith('.whl'))
    .sort();
  writeFileSync(MANIFEST, `${JSON.stringify({ comment: COMMENT, wheels }, null, 2)}\n`);
  console.log(`wrote ${basename(MANIFEST)} naming ${wheels.length} wheel(s)`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
