"""The names a session is holding.

A console keeps everything typed into it: a network, a solution, a figure, the half-dozen
intermediates that got there.  After a while it is genuinely hard to say what is defined
and what it holds -- and harder still to be sure a name means what it meant an hour ago.

This reports that, and empties it.  Both are about the *session* rather than about the
canvas, which is why they are not in ``nemo``: they would work the same in a console with
no drawing behind it at all.

Emptying is not restarting.  The interpreter, its imported modules and the time spent
starting it all stay; only the names go.  Restarting is the heavier hammer, and is what
stops something that is still running.
"""

import types

__all__ = ["variables", "clear"]

# Names the console puts there itself.  They are not the user's and are not theirs to
# lose, so they are neither listed nor cleared.
PROVIDED = frozenset({"nemo", "display"})

# Longest summary kept for one value.  A name's entry is a line in a list, and a value
# that reprs to a megabyte helps nobody read it.
SUMMARY_LIMIT = 120


def _kind(value) -> str:
    """What sort of thing a name holds, in the words a person would use."""
    if isinstance(value, types.ModuleType):
        return "module"
    if isinstance(value, type):
        return "class"
    if callable(value):
        return "function"
    return type(value).__name__


def _summary(value) -> str:
    """A short description of a value: its size where it has one, its repr otherwise."""
    if isinstance(value, types.ModuleType):
        return getattr(value, "__name__", "")
    if isinstance(value, type) or callable(value):
        return getattr(value, "__doc__", "") and value.__doc__.strip().split("\n")[0] or ""

    # A length is more use than a repr for anything that has one: it says how big the
    # thing is without printing it.
    try:
        shape = getattr(value, "shape", None)
        if shape is not None:
            return f"shape {tuple(shape)}"
    except Exception:
        pass
    try:
        if isinstance(value, (str, bytes, list, tuple, dict, set, frozenset)):
            return f"{len(value)} item{'' if len(value) == 1 else 's'}"
    except Exception:
        pass

    try:
        text = repr(value)
    except Exception:
        return "<cannot be shown>"
    text = " ".join(text.split())
    return text if len(text) <= SUMMARY_LIMIT else f"{text[: SUMMARY_LIMIT - 1]}…"


def variables(namespace: dict) -> list:
    """Every name the session holds, as ``{name, kind, summary}``, in alphabetical order.

    Names beginning with an underscore are left out, as are the ones the console put
    there itself: both are noise against what someone actually defined.
    """
    out = []
    for name in sorted(namespace):
        if name.startswith("_") or name in PROVIDED:
            continue
        value = namespace[name]
        out.append({"name": name, "kind": _kind(value), "summary": _summary(value)})
    return out


def clear(namespace: dict) -> int:
    """Forget every name the session holds, and report how many that was.

    What the console provided stays, so the prompt still works afterwards; so does
    everything under an underscore, which is the interpreter's own bookkeeping.
    """
    doomed = [n for n in list(namespace) if not n.startswith("_") and n not in PROVIDED]
    for name in doomed:
        del namespace[name]
    return len(doomed)
