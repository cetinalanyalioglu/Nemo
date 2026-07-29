/**
 * Rebuilds the wheels the Python console installs, from a checkout of the package.
 *
 *     npm run wheels -- ../Nefes
 *
 * The console installs what a *model* declares — the `solver.packages` list in its own
 * file — so this builds the wheel, drops it in `public/wheels`, removes the version it
 * replaces, and repoints every model that named the old one. The wheel is committed: the
 * app is served as static files, and a deploy has no way to build one.
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
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  copyFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WHEEL_DIR = resolve(fileURLToPath(new URL('../public/wheels', import.meta.url)));
const MODEL_DIR = resolve(fileURLToPath(new URL('../public/models', import.meta.url)));

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

/** The package a wheel is of: everything before the first hyphen, as the format has it. */
const packageOf = (wheel) => wheel.split('-')[0];

/**
 * Points every model that installs one of these wheels at the file just built.
 *
 * This is the step that makes a rebuild usable. The console installs what a model's
 * `solver.packages` names, and that names the wheel *by filename*, version and all — so
 * a rebuild at a new version leaves every model asking for a file that is no longer
 * there, and a console that dies at install with a 404. Nothing else reads the wheel
 * directory, so nothing else notices.
 *
 * Rewritten in place, by path, rather than by loading and re-dumping the YAML: a model
 * file is mostly comments explaining itself to whoever writes the next one, and a round
 * trip through a YAML library would throw every one of them away.
 */
const repointModels = (built) => {
  const changes = [];
  for (const file of readdirSync(MODEL_DIR).filter((name) => name.endsWith('.yaml'))) {
    const path = join(MODEL_DIR, file);
    const before = readFileSync(path, 'utf8');
    let after = before;
    for (const wheel of built) {
      // The same package at whatever version this file names now. Anchored on the
      // `wheels/` prefix so it cannot touch a bare requirement that shares the name.
      const naming = new RegExp(
        `wheels/${packageOf(wheel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[^\\s'"]*\\.whl`,
        'g'
      );
      after = after.replace(naming, (found) => {
        const replacement = `wheels/${wheel}`;
        if (found !== replacement) changes.push({ file, from: found, to: replacement });
        return replacement;
      });
    }
    if (after !== before) writeFileSync(path, after);
  }
  return changes;
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

  const repointed = repointModels(built);
  if (repointed.length === 0) {
    console.warn(
      'warning: no model names these wheels, so nothing will install them.\n' +
        `         Add them to solver.packages as wheels/<file> in a model under public/models.`
    );
  } else {
    for (const { file, from, to } of repointed) console.log(`  ${file}: ${from} -> ${to}`);
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}
