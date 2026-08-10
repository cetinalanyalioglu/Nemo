"""The canvas, as seen from Python.

This module is what the console's interpreter finds already imported.  It is the whole
of the Python side of the boundary: reading what is drawn, and sending results back to be
drawn on it.

Reading is a plain function call.  The case is copied into the interpreter before every
submission, so ``case()`` hands back what is on the canvas at the moment the line was
entered, with nothing to wait for.  Writing posts to the canvas and returns immediately;
the drawing happens a moment later, and any complaint about the data appears in the
message log rather than as an exception here.

The case document is the same one the canvas saves and loads, so anything that reads a
saved case reads this, and anything that writes one can be shown.

Where the model on the canvas brought a solver, three more calls go through it:
:func:`build` makes what the solver works on out of what is drawn, :func:`publish` sends
that model's results back to be drawn, and :func:`draw` replaces the drawing with a model
this session built rather than read.

None of the three knows which solver it is talking to.  Each calls the adapter the model
file declared, which is the one place any solver is named at all.  A model may also give
:func:`build` a second name that suits what that model builds; where it has, the name is
listed below beside the rest, and ``help()`` on it says what it makes.
"""

import json
import keyword
import math

import _nemo_host

__all__ = [
    "case",
    "title",
    "nodes",
    "edges",
    "counts",
    "show",
    "replace",
    "log",
    "build",
    "draw",
    "publish",
]

# What the module says about itself before a model has been asked.  The example a model
# offers is added underneath, so ``help(nemo)`` shows something runnable against the
# model that is actually on the canvas rather than a general description of the idea.
_BASE_DOC = __doc__

# The names this module already answers to.  A model's chosen second name for
# :func:`build` may not be any of them: taking one would leave the thing it replaced
# unreachable, which is a strange way to find out a name was already spoken for.
_RESERVED = frozenset(__all__) | {"nemo"}


def _dumps(obj) -> str:
    """Serialize to JSON the canvas can read back.

    A result field can hold a value that is not a number -- an unconverged entry, the
    phase of something that is exactly zero.  Python writes those as bare ``NaN`` and
    ``Infinity``, which are not JSON and would fail on arrival, so they are sent as null
    instead: the canvas already skips non-numeric entries when it scales a colour map.
    """
    try:
        return json.dumps(obj, allow_nan=False)
    except ValueError:
        return json.dumps(_finite(obj))


def _finite(obj):
    """``obj`` with every non-finite float replaced by ``None``."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _finite(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_finite(v) for v in obj]
    return obj


def _emit(call: dict) -> None:
    """Post one request to the canvas."""
    _nemo_host.emit(_dumps(call))


# --------------------------------------------------------------------------- #
# Reading the canvas
# --------------------------------------------------------------------------- #
def case() -> dict:
    """The network as it is drawn right now, as a case document.

    Returns
    -------
    dict
        The same mapping the canvas writes when it saves: ``model`` (the elements,
        their connections and their parameters), ``uiAttributes`` (where they sit),
        and ``data`` when result sets are loaded.

    Examples
    --------
    >>> doc = nemo.case()
    >>> len(doc["model"]["edges"])
    4
    """
    return json.loads(_nemo_host.caseJson)


def title() -> str:
    """The case title shown above the canvas."""
    return (case().get("meta") or {}).get("title") or ""


def nodes() -> list:
    """The elements, each as ``{index, id, type, name, attributes}``.

    ``index`` is the position a result series binds to: the *i*-th value of a node
    series belongs to the element whose index is *i*.
    """
    return [_element(n) for n in case()["model"]["nodes"]]


def edges() -> list:
    """The connections, each as ``{index, id, type, name, source, target, attributes}``."""
    out = []
    for e in case()["model"].get("edges", []):
        entry = _element(e)
        entry["source"] = e.get("source")
        entry["target"] = e.get("target")
        out.append(entry)
    return out


def counts() -> dict:
    """How many elements and connections are drawn, as ``{"nodes": n, "edges": m}``."""
    model = case()["model"]
    return {"nodes": len(model["nodes"]), "edges": len(model.get("edges", []))}


def _element(entry: dict) -> dict:
    """One node or edge of the case document, flattened for reading."""
    attrs = entry.get("attributes") or {}
    return {
        "index": attrs.get("index"),
        "id": entry.get("id"),
        "type": entry.get("type"),
        "name": attrs.get("label"),
        "attributes": attrs,
    }


# --------------------------------------------------------------------------- #
# Writing to the canvas
# --------------------------------------------------------------------------- #
def show(result) -> None:
    """Draw result sets on the network.

    Parameters
    ----------
    result : dict or list
        A whole case document (its result sets are taken and the drawing is left
        alone), a single result set (a mapping with ``items``), or a list of either.

    Notes
    -----
    Each series binds to the network by position, so it must carry exactly one value
    per element of its target.  A series that does not is refused, and says so in the
    message log.

    Examples
    --------
    >>> nemo.show({"name": "Guess", "items": [
    ...     {"name": "Pressure", "target": "edge", "unit": "Pa", "values": [1.0, 2.0]}]})
    """
    datasets = _as_datasets(result)
    if not datasets:
        raise ValueError("nothing to show: no result sets in what was given")
    _emit({"op": "datasets", "datasets": datasets})


def replace(doc: dict) -> None:
    """Replace the drawing with the network in ``doc``.

    Parameters
    ----------
    doc : dict
        A case document, as :func:`case` returns and as the canvas saves.

    Notes
    -----
    This discards what is on the canvas.  It is undoable there, but nothing is asked
    first, so it is worth being sure before calling it from a loop.
    """
    if not isinstance(doc, dict) or "model" not in doc:
        raise ValueError("replace() wants a case document: a mapping with a 'model' section")
    _emit({"op": "case", "doc": doc})


def log(message, level: str = "info") -> None:
    """Write a line to the message log beside this console.

    Parameters
    ----------
    message : str
        The text to record.
    level : {"info", "success", "warn", "error", "debug"}, optional
        How it is marked (default ``"info"``).
    """
    if level not in ("info", "success", "warn", "error", "debug"):
        raise ValueError(f"unknown level {level!r}")
    _emit({"op": "log", "level": level, "message": str(message)})


def _as_datasets(result) -> list:
    """The result sets in ``result``, whichever of the accepted shapes it is."""
    if isinstance(result, (list, tuple)):
        out = []
        for entry in result:
            out.extend(_as_datasets(entry))
        return out
    if not isinstance(result, dict):
        raise TypeError(f"cannot show a {type(result).__name__}; want a case document or result set")
    if "items" in result:
        return [result]
    if "data" in result:
        return list((result.get("data") or {}).get("datasets") or [])
    if "datasets" in result:
        return list(result["datasets"] or [])
    raise ValueError("no result sets found: expected a 'data' section, a 'datasets' list, or 'items'")


# --------------------------------------------------------------------------- #
# The solver the model brought, if it brought one
# --------------------------------------------------------------------------- #
def build():
    """What is drawn, built into whatever the model's solver works on.

    Returns
    -------
    object
        Whatever the model's adapter makes of a case document.  What that is depends
        entirely on the model; ``help()`` on this model's own name for this call, where
        it gives one, says what it makes.

    Raises
    ------
    RuntimeError
        When the model on the canvas declares no solver, or its adapter has no
        ``build``.

    See Also
    --------
    publish : send that model's results back to the canvas.
    draw : replace the drawing with a model built here.
    """
    return _adapter("build")(case())


def draw(model, **kwargs) -> None:
    """Draw a model built here on the canvas, in place of what is there.

    The other direction from :func:`build`.  A session that assembles its own model --
    from a script, from a parameter sweep, from a file it opened -- hands it over here
    and the canvas draws it, laying it out afresh.

    Parameters
    ----------
    model : object
        Whatever the model's solver works on.
    **kwargs
        Results to send along with it, exactly as :func:`publish` takes them, so a
        model and the answer for it can arrive together.

    Notes
    -----
    This replaces the drawing.  It is undoable on the canvas, but nothing is asked
    first, so it is worth being sure before calling it in a loop.
    """
    replace(_adapter("results")(model, **kwargs))


def publish(model, **kwargs) -> None:
    """Draw a solved model's results on the canvas.

    Parameters
    ----------
    model : object
        What :func:`build` returned, worked on.  Coming from there is what lets the
        canvas keep its own drawing; anything else is laid out afresh.
    **kwargs
        Which results to send.  What these are is the solver's business, not this
        module's: they are handed to the model's adapter as they are given.  Where the
        adapter documents what it takes, that documentation is added below.

    Notes
    -----
    Result sets arrive named, and a name is how several are told apart on the canvas,
    so a second run is worth naming rather than left to collide.
    """
    show(_adapter("results")(model, **kwargs))


# Kept as written, so the adapter's own account of what `results()` takes can be added
# underneath without the two compounding each time a model is loaded.
_PUBLISH_DOC = publish.__doc__


def _adapter(name):
    """The named function from the model's adapter, or a complaint that names the gap."""
    try:
        import _nemo_solver
    except ImportError:
        raise RuntimeError(
            "the model on the canvas declares no solver, so there is nothing to build "
            "a model with; nemo.case() and nemo.show() work regardless"
        ) from None
    fn = getattr(_nemo_solver, name, None)
    if fn is None:
        raise RuntimeError(f"this model's solver adapter defines no {name}()")
    return fn


# --------------------------------------------------------------------------- #
# Fitting the module to the model that is loaded
# --------------------------------------------------------------------------- #
def _adapter_doc(name: str) -> str:
    """What the model's adapter says about one of its own functions, if anything."""
    try:
        import _nemo_solver
    except ImportError:
        return ""
    doc = getattr(getattr(_nemo_solver, name, None), "__doc__", None)
    return doc.strip() if doc else ""


def _usable_name(name: str) -> bool:
    """Whether a model's chosen second name for :func:`build` can be given to it.

    Anything that is not an identifier would make an attribute no line of Python could
    reach, and anything already spoken for here would hide what it replaced.  Both are
    silent failures, so neither is accepted.
    """
    return bool(name) and name.isidentifier() and not keyword.iskeyword(name) and name not in _RESERVED


def _bind_alias(name: str) -> None:
    """Give :func:`build` the second name this model asked for.

    A separate function rather than another reference to the same one: the two carry
    different documentation, and a shared object has only one place to keep it.
    """
    if not _usable_name(name):
        return

    def alias():
        return build()

    alias.__name__ = name
    alias.__qualname__ = name
    # The adapter's own words where it has any, since it is the one that knows what it
    # builds; the general account otherwise.
    alias.__doc__ = _adapter_doc("build") or build.__doc__
    globals()[name] = alias
    if name not in __all__:
        __all__.append(name)


def _bind_model() -> None:
    """Fit this module to the model on the canvas.  Called once, after its adapter runs.

    Two things come from the model rather than from here: the second name it wants for
    :func:`build`, and a short example of using it.  Both are read from what the host
    supplies, so the browser's interpreter and the one on the machine are fitted by the
    same code and cannot come to describe themselves differently.
    """
    global __doc__

    _bind_alias(str(getattr(_nemo_host, "handle", "") or ""))

    example = str(getattr(_nemo_host, "example", "") or "").strip()
    if example:
        indented = "\n".join("    " + line if line else "" for line in example.split("\n"))
        __doc__ = f"{_BASE_DOC}\nFor the model on the canvas now::\n\n{indented}\n"
    else:
        __doc__ = _BASE_DOC

    takes = _adapter_doc("results")
    publish.__doc__ = f"{_PUBLISH_DOC}\n    What this model's adapter says of them:\n\n    {takes}\n" if takes else _PUBLISH_DOC
