# The Python console

The console pane has two tabs.
**Messages** is what the app has reported.
**Python** is a prompt, running in the browser, with the drawn network in reach.

Nothing is installed to use it.
The interpreter is fetched the first time a line is entered — some tens of megabytes, four or five seconds on a warm connection — and whatever packages the model on the canvas declares are installed on top of it, so its solver is there as soon as the prompt is.

## What is already there

A `nemo` module is imported before the first prompt.
It is the whole of the Python side of the boundary: reading what is drawn, and sending results back to be drawn on it.

| Call                   | What it does                                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| `nemo.case()`          | The network as a case document — the same mapping the app saves and loads |
| `nemo.title()`         | The case title shown above the canvas                                     |
| `nemo.nodes()`         | The elements, each as `{index, id, type, name, attributes}`               |
| `nemo.edges()`         | The connections, the same plus `source` and `target`                      |
| `nemo.counts()`        | How many of each are drawn                                                |
| `nemo.show(result)`    | Draws result sets on the network                                          |
| `nemo.replace(doc)`    | Replaces the drawing with the network in a case document                  |
| `nemo.log(message)`    | Writes a line to the Messages tab                                         |
| `nemo.network()`       | Builds what the model's solver works on                                   |
| `nemo.publish(net, …)` | Sends that model's results back to the canvas                             |

`help(nemo)` documents them at the prompt, and `help(nemo.publish)` names what results it takes.

The last two are the only ones that depend on a solver, and even they do not name one — see [the model's solver](#the-models-solver) below. On a model that declares none they say so and the rest still works.

## The round trip

```python
net = nemo.network()
sol = net.solve()
nemo.publish(net, solution=sol)
```

That is the whole loop: the network is read from the canvas, solved, and its fields land as a result set the Data pane can colour the network with.
What `publish` accepts is the solver's business, not the console's. For the Nefes model it is whatever `nefes.io.case_to_dict` takes, so a forced response, an eigenmode, or a Nyquist summary go the same way:

```python
from nefes.perturbation import forced_response
fr = forced_response(sol.problem, sol.x, [100.0, 200.0, 400.0])
nemo.publish(net, solution=sol, forced=fr, forced_sweep=True)
```

That one lands as an animated result set with frequency as the frame variable, and the canvas offers playback over it.

None of that is built in.
`nemo.show` takes any result set of the shape the case format declares, so a series worked out at the prompt draws just as well:

```python
import math
edges = nemo.edges()
nemo.show({"name": "Guesswork", "items": [
    {"name": "Something", "target": "edge", "unit": "Pa",
     "values": [100.0 * math.sin(e["index"]) for e in edges]},
]})
```

## The model's solver

Nemo has no solver in it, and this console did not put one there.
A model is a YAML file describing an element library, and it may additionally describe how to compute with what is drawn:

```yaml
solver:
  packages:
    - wheels/nefes-0.1.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl
  adapter: |
    from nefes.io import case_from_dict, case_to_dict

    def build(doc):
        return case_from_dict(doc, source="<canvas>")

    def results(net, **kwargs):
        kwargs.setdefault("internal_edges", False)
        return case_to_dict(net, **kwargs)

    def describe():
        import nefes
        return f"nefes {nefes.__version__} ({nefes.backend()} kernels)"
```

`packages` are installed into the interpreter when it starts, resolved against the app's base.
`adapter` is run once afterwards, and `nemo.network()` and `nemo.publish()` are calls into the `build` and `results` it defines; `describe()`, if present, is the line the status bar shows.

That is the whole of it. The app knows a model may name packages and some Python; it never knows what either is for, exactly as the data pane colours a network from whatever a file declares without knowing what the numbers mean.

Two consequences worth expecting:

- **Switching models restarts the interpreter**, since a different model brings different packages, and every name defined at the prompt goes with it.
- **A model with no solver still gets a console.** It boots in about a second rather than five, because there is nothing to install, and `nemo.network()` says plainly that there is nothing to build with.

## What binds a series to the network

Position, and nothing else: the _i_-th value of a series belongs to the element whose index is _i_.
So a series has to carry exactly one value per element of its target, and one that does not is refused — with a message in the Messages tab naming how it did not fit, rather than landing on the wrong elements.

The indices are brought up to date whenever the case is read, exactly as they are on save, so what `nemo.nodes()` reports is what a series will bind to.

One element on the canvas is not always one element in the solver: an orifice, a nozzle or a segmented pipe expands into several joined by edges the drawing never shows.
`nemo.publish` leaves that interior out, so what it sends is as long as what is drawn.
Read it at the prompt instead — `net.composite("orf")` gives the interior of a solved one.

A value that is not a number — an unconverged entry, the phase of something that is exactly zero — arrives as nothing rather than as `NaN`, which JSON has no word for.
The colour scale already skips such entries.

## What the case looks like on each side

The canvas hands the case over as it stands when a line is entered, and is not read again while that line runs.
So `nemo.case()` is a copy, and editing it changes nothing on the canvas; `nemo.replace(doc)` is how an edited one is put back, and it discards what was drawn.
A document that carries result sets is offered for choosing on the way in, as any loaded case is.

## Stopping something

Restart discards the interpreter and starts a fresh one, and is also how a run that is taking too long is stopped.
Every name defined at the prompt goes with it.

There is no way to interrupt a running line and keep the session: that needs memory shared between the page and the worker, which browsers only grant a page served with headers a static host cannot set.

## How fast it is

Nefes carries three implementations of its kernels, and there is no compiler in a browser to build one with, so which is installed is decided when the wheel is built rather than when the page loads.
The status line says which arrived:

```
READY  Python 3.14.2 · nefes 0.1.0 (accel kernels)
```

`accel` are the kernels compiled ahead of time to WebAssembly, and are what the committed wheel carries.
`python` means the wheel had nothing compiled in it, which is correct and much slower.

Measured in the browser on a 42-element reacting network — a rich-quench-lean combustor with thirteen species in equilibrium:

| kernels               | one solve |
| --------------------- | --------- |
| `accel` (WebAssembly) | 1.7 s     |
| `python`              | 58 s      |

The gap narrows sharply on small non-reacting networks, where the sparse solve rather than the kernels sets the pace: a four-element perfect-gas nozzle is 17 ms against 50 ms.
Chemistry is what the compiled kernels are for.

A word on what "in the browser" costs: the same reacting solve is 222 ms on a desktop install with numba, so the browser is some eight times slower than a workstation and not in a different league from one.

## Refreshing the wheels

The app is served as static files and a deploy has no way to build anything, so the wheels are committed.

Which wheels are installed is declared by the model that needs them, in `public/models/*.yaml`; `npm run wheels` rebuilds them and leaves the naming alone.

The browser's Python is WebAssembly, so a wheel with compiled parts is a _cross_-compile: the machine that builds it cannot run what it produces.
That needs `pyodide build` from a Python of the same version as the browser's, and an Emscripten toolchain of the version its build environment names.
Neither is installed by this repo. Once they are:

```bash
PYODIDE=~/.conda/envs/pyodide-build/bin/pyodide \
EMSDK_ENV=~/emsdk/emsdk_env.sh \
npm run wheels -- ../Nefes
```

That builds the wheel, drops it in `public/wheels`, removes the version it replaces, and rewrites `public/wheels/manifest.json` to name it.
The console installs whatever the manifest lists, in order.

`npm run wheels -- ../Nefes --pure` skips the cross-compile and builds a wheel with nothing compiled in it, which needs only a plain Python and lands in the second row of the table above.

## Where the pieces are

| File                           | What it holds                                                    |
| ------------------------------ | ---------------------------------------------------------------- |
| `src/python/protocol.ts`       | The messages the console and the interpreter exchange            |
| `src/python/runtime.worker.ts` | The interpreter itself, off the main thread                      |
| `src/python/python-runtime.ts` | Starting it, feeding it lines, routing what comes back           |
| `src/python/bridge.ts`         | What Python is allowed to do to the canvas, and the checks on it |
| `src/python/nemo-module.py`    | The `nemo` module, as Python sees it                             |
| `public/models/*.yaml`         | Each model's own solver: its packages and its adapter            |
| `src/store/pythonStore.ts`     | The transcript, the prompt state, the recall list                |

`src/python/nemo-module.test.ts` runs the Python module under a real interpreter and skips where there is none; point `PYTHON` at one that has Nefes in it to include it.
