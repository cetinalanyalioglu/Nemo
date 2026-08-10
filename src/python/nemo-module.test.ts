/**
 * The Python side of the boundary, run under a real interpreter.
 *
 * `nemo-module.py` is the only part of this app written in another language, and the
 * browser is the only place it otherwise runs. So it is exercised here the way the
 * worker sets it up — a stand-in for the host, the case handed over as JSON, what it
 * emits collected, and the solver adapter taken from the model file exactly as the
 * console takes it. That last one means the shipped adapter is under test too, and not
 * a copy of it written to pass.
 *
 * The whole file skips where there is no interpreter with the model's solver installed,
 * which is every machine that only builds the front end. Set `PYTHON` to point at one.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { NEMO_NAMES } from '../models/model-builder';
import type { ModelDefinition } from '../types/flow';

const PYTHON = process.env.PYTHON ?? 'python3';
const MODULE = resolve(__dirname, 'nemo-module.py');

/** The Nefes model's solver section — the adapter, and the words it fits `nemo` out with. */
const SOLVER = (
  yaml.load(
    readFileSync(resolve(__dirname, '../../public/models/nefes.yaml'), 'utf8')
  ) as ModelDefinition
).solver;

/** The adapter the Nefes model declares — what `nemo.network()` and `publish()` call. */
const ADAPTER = SOLVER?.adapter;

/** Whether an interpreter the model's adapter can run in is reachable. */
const usable = (() => {
  if (!ADAPTER) return false;
  try {
    execFileSync(PYTHON, ['-c', ADAPTER], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Runs `body` with the bridge module imported as `nemo`, the way the worker arranges
 * it, and returns what `body` printed as JSON.
 */
const withBridge = (
  body: string,
  model: { handle?: string; example?: string; adapter?: string } = {}
): Record<string, unknown> => {
  const dir = mkdtempSync(join(tmpdir(), 'nemo-bridge-'));
  const handle = model.handle ?? SOLVER?.handle ?? '';
  const example = model.example ?? SOLVER?.example ?? '';
  const adapter = model.adapter ?? ADAPTER ?? '';
  try {
    // The worker writes each module out under the name it is imported by; so does this.
    copyFileSync(MODULE, join(dir, 'nemo.py'));
    writeFileSync(join(dir, '_nemo_solver.py'), adapter);
    const driver = `
import json, sys, types

# The stand-in for the host: the case is assigned here rather than asked for, and
# everything sent back is collected instead of posted. The model's own words about
# itself arrive the same way they do in the browser.
host = types.ModuleType("_nemo_host")
host.caseJson = "{}"
host.handle = ${JSON.stringify(handle)}
host.example = ${JSON.stringify(example)}
host.emitted = []
host.emit = host.emitted.append
sys.modules["_nemo_host"] = host
sys.path.insert(0, ${JSON.stringify(dir)})

import nemo

# As the worker does, once the adapter has been loaded.
nemo._bind_model()

def emitted():
    return [json.loads(e) for e in host.emitted]

${body}
`;
    writeFileSync(join(dir, 'driver.py'), driver);
    const out = execFileSync(PYTHON, [join(dir, 'driver.py')], { encoding: 'utf8' });
    return JSON.parse(out.trim().split('\n').pop() as string);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Builds a small network in Nefes and hands the canvas its case. */
const NOZZLE = `
from nefes.elements import catalog as cat
from nefes.io import case_to_dict
from nefes.shell import Network
from nefes.thermo.configure import perfect_gas

net = Network(perfect_gas(287.0, 1.4), p_ref=101325.0, T_ref=300.0, mdot_ref=5.0)
net.add(cat.total_pressure_inlet(200000.0, 300.0, name="reservoir"))
net.add(cat.duct(0.5, name="feed"))
net.add(cat.isentropic_area_change(name="nozzle"))
net.add(cat.duct(0.3, name="tail"))
net.add(cat.pressure_outlet(150000.0, 300.0, name="back"))
net.connect(0, 1, 0.02, name="feed")
net.connect(1, 2, 0.02, name="pipe")
net.connect(2, 3, 0.01, name="throat")
net.connect(3, 4, 0.01, name="tailpipe")
host.caseJson = json.dumps(case_to_dict(net, title="Nozzle"))
`;

describe.skipIf(!usable)('reading the canvas from Python', () => {
  it('sees the network that is drawn, element by element', () => {
    const result = withBridge(`${NOZZLE}
print(json.dumps({
    "title": nemo.title(),
    "counts": nemo.counts(),
    "edges": [e["name"] for e in nemo.edges()],
    "indices": [e["index"] for e in nemo.edges()],
    "first_node": {k: nemo.nodes()[0][k] for k in ("index", "type", "name")},
}))`);

    expect(result.title).toBe('Nozzle');
    expect(result.counts).toEqual({ nodes: 5, edges: 4 });
    expect(result.edges).toEqual(['feed', 'pipe', 'throat', 'tailpipe']);
    // The indices are what a result series binds to, so they must be there and distinct.
    expect(result.indices).toEqual([0, 1, 2, 3]);
    expect(result.first_node).toEqual({ index: 0, type: 'TotalPressureInlet', name: 'reservoir' });
  });
});

describe.skipIf(!usable)('sending results back', () => {
  it('takes the result sets out of a whole case document', () => {
    const result = withBridge(`${NOZZLE}
sol = net.solve()
nemo.publish(net, solution=sol)
call = emitted()[0]
print(json.dumps({
    "op": call["op"],
    "names": [d["name"] for d in call["datasets"]],
    "mdot": [d for d in call["datasets"][0]["items"] if d["name"] == "Mass flow"][0]["values"],
    "converged": bool(sol.converged),
}))`);

    expect(result.op).toBe('datasets');
    expect(result.names).toContain('Mean flow');
    expect(result.converged).toBe(true);
    // One value per connection, in the order the indices above run.
    expect(result.mdot).toHaveLength(4);
  });

  it('takes a bare result set as well as a document', () => {
    const result = withBridge(`
nemo.show({"name": "Guess", "items": [
    {"name": "p", "target": "edge", "values": [1.0, 2.0]}]})
nemo.show([{"name": "A", "items": []}, {"name": "B", "items": []}])
print(json.dumps([[d["name"] for d in c["datasets"]] for c in emitted()]))`);

    expect(result).toEqual([['Guess'], ['A', 'B']]);
  });

  it('sends a value that is not a number as nothing, since JSON has no word for it', () => {
    const result = withBridge(`
nemo.show({"name": "Gappy", "items": [
    {"name": "g", "target": "edge", "values": [float("nan"), 1.0, float("inf"), 3.0]}]})
print(json.dumps(emitted()[0]["datasets"][0]["items"][0]["values"]))`);

    expect(result).toEqual([null, 1, null, 3]);
  });

  it('refuses to send something with no result sets in it', () => {
    const result = withBridge(`
def failure(call):
    try:
        call()
    except Exception as exc:
        return type(exc).__name__
    return "no error"

print(json.dumps({
    "empty": failure(lambda: nemo.show({"meta": {}})),
    "wrong_type": failure(lambda: nemo.show(42)),
    "not_a_case": failure(lambda: nemo.replace({"nodes": []})),
    "unknown_level": failure(lambda: nemo.log("hi", "shout")),
    "nothing_sent": len(emitted()),
}))`);

    expect(result.empty).toBe('ValueError');
    expect(result.wrong_type).toBe('TypeError');
    expect(result.not_a_case).toBe('ValueError');
    expect(result.unknown_level).toBe('ValueError');
    expect(result.nothing_sent).toBe(0);
  });
});

describe.skipIf(!usable)('the round trip', () => {
  it('builds the drawn network and solves it to the same answer as the case it came from', () => {
    const result = withBridge(`${NOZZLE}
reference = net.solve()
rebuilt = nemo.network()
again = rebuilt.solve()
print(json.dumps({
    "both_converged": bool(reference.converged and again.converged),
    "reference": list(reference.field("mdot")),
    "rebuilt": list(again.field("mdot")),
}))`);

    expect(result.both_converged).toBe(true);
    // Going out through the case document and back is not allowed to change the flow.
    const reference = result.reference as number[];
    const rebuilt = result.rebuilt as number[];
    expect(rebuilt).toHaveLength(reference.length);
    rebuilt.forEach((value, i) => expect(value).toBeCloseTo(reference[i], 9));
  });
});

describe.skipIf(!usable)('fitting the module to the model', () => {
  it('gives build the second name the model asked for, and leaves build itself', () => {
    const result = withBridge(`
print(json.dumps({
    "has_alias": hasattr(nemo, "network"),
    "listed": "network" in nemo.__all__,
    "build_still_there": hasattr(nemo, "build"),
    "found_by_dir": "network" in dir(nemo),
}))`);

    expect(result.has_alias).toBe(true);
    expect(result.build_still_there).toBe(true);
    // `help(nemo)` lists what `__all__` names; completion walks `dir()`. Both matter.
    expect(result.listed).toBe(true);
    expect(result.found_by_dir).toBe(true);
  });

  it('documents the alias with the adapter’s own words, without rewriting build’s', () => {
    // The trap this pins: `network = build` would be one object with one docstring, so
    // documenting the alias would silently redocument the general call as well.
    const result = withBridge(`
print(json.dumps({
    "same_object": nemo.network is nemo.build,
    "alias_doc": (nemo.network.__doc__ or "").strip().split("\\n")[0],
    "build_doc": (nemo.build.__doc__ or "").strip().split("\\n")[0],
}))`);

    expect(result.same_object).toBe(false);
    expect(result.alias_doc).toBe('The drawn network, ready to solve.');
    expect(result.build_doc).not.toBe(result.alias_doc);
  });

  it('answers help(nemo) with something runnable against the model on the canvas', () => {
    const result = withBridge(`
print(json.dumps({"doc": nemo.__doc__ or ""}))`);

    const doc = result.doc as string;
    expect(doc).toContain('nemo.network()');
    expect(doc).toContain('nemo.publish(net, solution=sol)');
  });

  it('answers what publish takes with what this model’s adapter says it takes', () => {
    const result = withBridge(`
print(json.dumps({"doc": nemo.publish.__doc__ or ""}))`);

    const doc = result.doc as string;
    // The general contract stays, and the model's own account is added under it.
    expect(doc).toContain("the solver's business");
    expect(doc).toContain('eigenmodes=');
  });

  it('offers no second name where the model asked for none', () => {
    const result = withBridge(
      `
print(json.dumps({
    "has_alias": hasattr(nemo, "network"),
    "has_build": hasattr(nemo, "build"),
    "doc_has_example": "nemo.network()" in (nemo.__doc__ or ""),
}))`,
      { handle: '', example: '' }
    );

    expect(result.has_alias).toBe(false);
    // `build` is always there; it is only the convenience that is the model's to name.
    expect(result.has_build).toBe(true);
    expect(result.doc_has_example).toBe(false);
  });

  it('refuses a name that would hide one of its own', () => {
    const result = withBridge(
      `
print(json.dumps({"case_is_callable": callable(nemo.case), "reads": nemo.case()  == {}}))`,
      { handle: 'case' }
    );

    expect(result.case_is_callable).toBe(true);
    expect(result.reads).toBe(true);
  });

  it('refuses a name no line of Python could reach', () => {
    const result = withBridge(
      `
print(json.dumps({"names": [n for n in dir(nemo) if not n.startswith("_")]}))`,
      { handle: 'not a name' }
    );

    expect(result.names as string[]).not.toContain('not a name');
  });
});

describe('the reserved names the app validates against', () => {
  it('are the names the module declares, checked without an interpreter', () => {
    // Deliberately outside the skip. Everything else here needs an interpreter with the
    // model's solver installed, which most machines are not — and a safety net that only
    // exists on some machines is not a safety net. Checking for drift needs neither a
    // solver nor a canvas nor Python at all: the list is a literal in the source.
    const source = readFileSync(MODULE, 'utf8');
    const declaration = /__all__\s*=\s*\[([^\]]*)\]/.exec(source);
    expect(declaration, 'nemo-module.py declares no __all__').not.toBeNull();

    const declared = [...declaration![1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(declared.length).toBeGreaterThan(0);
    // `nemo` is not in `__all__` — it is the module's own name rather than something in
    // it — but a model may not take that one either, so the app's list carries it.
    expect([...declared].sort()).toEqual([...NEMO_NAMES].filter((n) => n !== 'nemo').sort());
  });
});

describe.skipIf(!usable)('the reserved names, against a running module', () => {
  it('are the names the module actually answers to', () => {
    // The app refuses a model whose `handle` would hide one of these, and keeps its own
    // list because it never parses the Python. This is what keeps the two in step: a
    // name added to the module and forgotten there fails here rather than in a console.
    const result = withBridge(`
print(json.dumps({"names": list(nemo.__all__)}))`);

    const listed = new Set(result.names as string[]);
    // The alias the model asked for is bound at boot, not part of the module's own set.
    listed.delete('network');
    expect([...listed].sort()).toEqual([...NEMO_NAMES].filter((n) => n !== 'nemo').sort());
  });
});
