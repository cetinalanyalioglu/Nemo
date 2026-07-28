# The Python console

The console pane has two tabs.
**Messages** is what the app has reported.
**Python** is a prompt, running in the browser, with the drawn network in reach.

Nothing is installed to use it.
The interpreter is fetched the first time a line is entered — some tens of megabytes, four or five seconds on a warm connection — and the packages under `public/wheels` are installed on top of it, so Nefes is there as soon as the prompt is.

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
| `nemo.network()`       | Builds the drawn network into a Nefes network, ready to solve             |
| `nemo.publish(net, …)` | Sends a Nefes network's results back to the canvas                        |

`help(nemo)` documents them at the prompt, and `help(nemo.publish)` names what results it takes.

## The round trip

```python
net = nemo.network()
sol = net.solve()
nemo.publish(net, solution=sol)
```

That is the whole loop: the network is read from the canvas, solved, and its fields land as a result set the Data pane can colour the network with.
`publish` takes whatever `nefes.io.case_to_dict` does, so a forced response, an eigenmode, or a Nyquist summary go the same way:

```python
from nefes.perturbation import forced_response
fr = forced_response(sol.problem, sol.x, [100.0, 200.0, 400.0])
nemo.publish(net, solution=sol, forced=fr, forced_sweep=True)
```

That one lands as an animated result set with frequency as the frame variable, and the canvas offers playback over it.

Nothing is special about Nefes here.
`nemo.show` takes any result set of the shape the case format declares, so a series worked out at the prompt draws just as well:

```python
import math
edges = nemo.edges()
nemo.show({"name": "Guesswork", "items": [
    {"name": "Something", "target": "edge", "unit": "Pa",
     "values": [100.0 * math.sin(e["index"]) for e in edges]},
]})
```

## What binds a series to the network

Position, and nothing else: the _i_-th value of a series belongs to the element whose index is _i_.
So a series has to carry exactly one value per element of its target, and one that does not is refused — with a message in the Messages tab naming how it did not fit, rather than landing on the wrong elements.

The indices are brought up to date whenever the case is read, exactly as they are on save, so what `nemo.nodes()` reports is what a series will bind to.

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

Nefes carries three implementations of its kernels.
The browser has no compiler to build them with, so it runs the plain-Python one unless a WebAssembly build of the compiled kernels is installed, which the status line names:

```
READY  Python 3.14.2 · nefes 0.1.0 (python kernels)
```

Plain Python is correct and slow — a small perfect-gas network solves in under a second, a reacting network of some tens of elements in tens of seconds.
Replacing the wheel with one built by `pyodide build` puts `accel` in that line instead and is roughly thirty times quicker.

## Refreshing the wheels

The app is served as static files and a deploy has no way to build anything, so the wheels are committed.
Rebuild them from a checkout of the package:

```bash
npm run wheels -- ../Nefes
```

That builds a wheel, drops it in `public/wheels`, removes the version it replaces, and rewrites `public/wheels/manifest.json` to name it.
The console installs whatever the manifest lists, in order.

## Where the pieces are

| File                           | What it holds                                                    |
| ------------------------------ | ---------------------------------------------------------------- |
| `src/python/protocol.ts`       | The messages the console and the interpreter exchange            |
| `src/python/runtime.worker.ts` | The interpreter itself, off the main thread                      |
| `src/python/python-runtime.ts` | Starting it, feeding it lines, routing what comes back           |
| `src/python/bridge.ts`         | What Python is allowed to do to the canvas, and the checks on it |
| `src/python/nemo-module.py`    | The `nemo` module, as Python sees it                             |
| `src/store/pythonStore.ts`     | The transcript, the prompt state, the recall list                |

`src/python/nemo-module.test.ts` runs the Python module under a real interpreter and skips where there is none; point `PYTHON` at one that has Nefes in it to include it.
