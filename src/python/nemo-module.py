"""The canvas, as seen from Python.

This module is what the console's interpreter finds already imported.  It is the whole
of the Python side of the boundary: reading the network that is drawn, and sending
results back to be drawn on it.

Reading is a plain function call.  The case is copied into the interpreter before every
submission, so ``case()`` hands back what is on the canvas at the moment the line was
entered, with nothing to wait for.  Writing posts to the canvas and returns immediately;
the drawing happens a moment later, and any complaint about the data appears in the
message log rather than as an exception here.

The case document is the same one the canvas saves and loads, so anything that reads a
saved case reads this, and anything that writes one can be shown.  With Nefes installed
the round trip is two calls::

    net = nemo.network()
    sol = net.solve()
    nemo.publish(net, solution=sol)
"""

import json
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
    "network",
    "publish",
]


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
# Nefes, when it is installed
# --------------------------------------------------------------------------- #
def network():
    """The drawn network, built into a Nefes network ready to solve.

    Returns
    -------
    nefes.shell.Network

    See Also
    --------
    publish : send a solved network's results back to the canvas.

    Examples
    --------
    >>> net = nemo.network()
    >>> sol = net.solve()
    >>> sol.converged
    True
    """
    from nefes.io import case_from_dict

    return case_from_dict(case(), source="<canvas>")


def publish(net, **kwargs) -> None:
    """Draw a Nefes network's results on the canvas.

    Parameters
    ----------
    net : nefes.shell.Network
        The network the results belong to.  When it came from :func:`network` the
        canvas keeps its own layout; otherwise a fresh one is drawn.
    **kwargs
        Which results to send, as :func:`nefes.io.case_to_dict` takes them --
        ``solution=``, ``forced=``, ``eigenmodes=``, ``nyquist=`` and so on.

    Examples
    --------
    >>> net = nemo.network()
    >>> nemo.publish(net, solution=net.solve())
    """
    from nefes.io import case_to_dict

    show(case_to_dict(net, **kwargs))
