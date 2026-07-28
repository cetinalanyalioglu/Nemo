/**
 * The Python side of the boundary, run under a real interpreter.
 *
 * `nemo-module.py` is the only part of this app written in another language, and the
 * browser is the only place it otherwise runs. So it is exercised here the way the
 * worker sets it up — a stand-in for the host, the case handed over as JSON, and what
 * it emits collected — against the package it exists to reach.
 *
 * The whole file skips where there is no interpreter with Nefes in it, which is every
 * machine that only builds the front end. Set `PYTHON` to point at one.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PYTHON = process.env.PYTHON ?? 'python3';
const MODULE = resolve(__dirname, 'nemo-module.py');

/** Whether an interpreter with Nefes in it can be reached. */
const usable = (() => {
  try {
    execFileSync(PYTHON, ['-c', 'import nefes'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Runs `body` with the bridge module imported as `nemo`, the way the worker arranges
 * it, and returns what `body` printed as JSON.
 */
const withBridge = (body: string): Record<string, unknown> => {
  const dir = mkdtempSync(join(tmpdir(), 'nemo-bridge-'));
  try {
    // The worker writes the module out under the name it is imported by; so does this.
    copyFileSync(MODULE, join(dir, 'nemo.py'));
    const driver = `
import json, sys, types

# The stand-in for the host: the case is assigned here rather than asked for, and
# everything sent back is collected instead of posted.
host = types.ModuleType("_nemo_host")
host.caseJson = "{}"
host.emitted = []
host.emit = host.emitted.append
sys.modules["_nemo_host"] = host
sys.path.insert(0, ${JSON.stringify(dir)})

import nemo

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
