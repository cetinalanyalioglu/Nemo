/**
 * Rebuilds the wheels the Python console installs, from a checkout of the package.
 *
 *     npm run wheels -- ../Nefes
 *
 * The console installs whatever `public/wheels/manifest.json` lists, so this builds the
 * wheel, drops it beside the manifest, removes the version it replaces, and rewrites the
 * manifest to name it. The wheel is committed: the app is served as static files, and a
 * deploy has no way to build one.
 *
 * The build is a *cross*-compile — the browser's Python is WebAssembly, so a wheel with
 * compiled parts has to be built for it, and the machine doing the building cannot run
 * what it produces. That needs two things this script does not install:
 *
 *   - `pyodide build`, from a Python whose version matches the one in the browser
 *     (`pip install pyodide-build`, then `pyodide xbuildenv install <version>`);
 *   - an Emscripten toolchain of the version that build environment names, on PATH.
 *
 * Point PYODIDE at the first and pass the second by sourcing its environment script
 * before running, or set EMSDK_ENV to it and this will source it:
 *
 *     PYODIDE=~/.conda/envs/pyodide-build/bin/pyodide \
 *     EMSDK_ENV=~/emsdk/emsdk_env.sh \
 *     npm run wheels -- ../Nefes
 *
 * Passing `--pure` skips all of that and builds a wheel with nothing compiled in it.
 * That one runs anywhere and is some thirty times slower on a reacting network.
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

const args = process.argv.slice(2);
const pure = args.includes('--pure');
const source = args.find((a) => !a.startsWith('-'));
if (!source) {
  console.error('usage: npm run wheels -- <path-to-nefes-checkout> [--pure]');
  process.exit(1);
}

const staging = mkdtempSync(join(tmpdir(), 'nemo-wheels-'));

/** Runs the build, in a shell when an Emscripten environment has to be sourced first. */
const runBuild = (src) => {
  if (pure) {
    const python = process.env.PYTHON ?? 'python3';
    execFileSync(python, ['-m', 'pip', 'wheel', src, '--no-deps', '-w', staging], {
      stdio: 'inherit',
    });
    return;
  }
  const pyodide = process.env.PYODIDE ?? 'pyodide';
  const emsdkEnv = process.env.EMSDK_ENV;
  const build = `${JSON.stringify(pyodide)} build --outdir ${JSON.stringify(staging)}`;
  const script = emsdkEnv ? `. ${JSON.stringify(emsdkEnv)} >/dev/null && ${build}` : build;
  execFileSync('bash', ['-c', script], {
    cwd: src,
    stdio: 'inherit',
    // The kernels are compiled ahead of time only when asked; this is the asking.
    env: { ...process.env, NEFES_BUILD_ACCEL: '1' },
  });
};

try {
  console.log(`building ${pure ? 'a pure-Python' : 'a WebAssembly'} wheel from ${resolve(source)}`);
  runBuild(resolve(source));

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
