"""What the interpreter can say about what is half-typed.

Two questions, both answered from the objects the session is actually holding rather than
from a reading of the text: *what names could finish this*, and *what does this call
take*.  Reading the objects is what makes the answers true of the solver the model
brought, whatever it is, without anything here knowing one solver from another.

It also fixes the limit.  A name exists once something has defined it, so a fresh notebook
has little to offer until its first cell has run -- which is the same rule the prompt has
always worked by, and the same one that makes ``sol.`` list the fields of the solution
actually in hand rather than of solutions in general.

Nothing here runs the code being typed.  Completion evaluates plain dotted names and no
more, so ``net.solve().`` completes nothing rather than solving anything, and attributes
are read without waking the properties behind them.

Both interpreters use this file: the one in the browser and the one served from the
machine.  What is offered cannot differ between them, because there is only one of it.

Exports ``completions`` and ``signature``.
"""

import builtins
import inspect
import keyword
import re
import rlcompleter
import types

__all__ = ["completions", "signature"]

# Where a word ends, going backwards from the caret.  A dot is deliberately absent: a
# dotted name is one word here, since that is what a completer is given.
WORD_BREAK = set(" \t\n\r\f\v`~!@#$%^&*()-=+[{]}\\|;:'\",<>/?")

# Most names offered at once.  ``dir()`` on a large module runs to hundreds, and a list
# nobody can read is no better than no list.
LIMIT = 200

# Longest signature shown beside a name in the list.
DETAIL_LIMIT = 90

# Longest documentation carried with a signature.
DOC_LIMIT = 600

# The dotted name a bracket was opened on, taken from the text in front of it.
CALLEE = re.compile(r"([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*$")

# A dotted name and nothing else: no call, no subscript, no operator.  Only these are
# evaluated, so completing never runs what is being written.
PLAIN_NAME = re.compile(r"^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$")

# The name at the front of a match.  A completer decorates what it returns -- a bracket
# after something callable, a space or a colon after a keyword -- and that decoration is
# a remark about the name rather than part of it.
BARE_NAME = re.compile(r"[A-Za-z_]\w*")

# Stands for "there is no object behind this name", which None cannot: None is a value a
# name can perfectly well hold.
_UNKNOWN = object()


def _word_start(source: str) -> int:
    """Where the word under the caret begins."""
    for i in range(len(source) - 1, -1, -1):
        if source[i] in WORD_BREAK:
            return i + 1
    return 0


def _bare(match: str) -> str:
    """The name inside a completer's match, without what it decorated it with."""
    found = BARE_NAME.match(match)
    return found.group(0) if found else ""


def _evaluate(expression: str, namespace: dict):
    """The object a plain dotted name stands for, or ``_UNKNOWN``.

    Only a dotted name is evaluated.  Anything else -- a call, a subscript, arithmetic --
    is refused rather than run, since completing a line is not a reason to execute it.
    """
    if not PLAIN_NAME.match(expression):
        return _UNKNOWN
    try:
        return eval(expression, namespace)  # noqa: S307 - a dotted name, checked above
    except Exception:
        return _UNKNOWN


def _member(owner, name: str, namespace: dict):
    """The object a completion would name, without waking anything to find out.

    An attribute is read statically, so a property is reported as a property rather than
    being called to see what it would return.
    """
    if owner is _UNKNOWN:
        return _UNKNOWN
    if owner is None:
        if name in namespace:
            return namespace[name]
        return getattr(builtins, name, _UNKNOWN)
    try:
        value = inspect.getattr_static(owner, name)
    except Exception:
        return _UNKNOWN

    # Read off the class, a method still asks for the instance as its first argument.
    # Binding it is what reading it through the instance would have done, and is the
    # difference between offering "field(self, name)" and offering "field(name)".
    if isinstance(value, types.FunctionType) and not isinstance(owner, (type, types.ModuleType)):
        try:
            return value.__get__(owner)
        except Exception:
            return value
    return value


def _kind(value, name: str) -> str:
    """What sort of thing a name holds, in the words the list puts an icon to."""
    if keyword.iskeyword(name):
        return "keyword"
    if value is _UNKNOWN:
        return "variable"
    if isinstance(value, types.ModuleType):
        return "namespace"
    if isinstance(value, type):
        return "class"
    if isinstance(value, property):
        return "property"
    if isinstance(value, (staticmethod, classmethod)) or inspect.ismethod(value):
        return "method"
    if inspect.isroutine(value):
        return "function"
    return "variable"


def _clip(text: str, limit: int) -> str:
    text = text.strip()
    return text if len(text) <= limit else f"{text[: limit - 1]}…"


def _signature_of(value):
    """The parameters something takes, or None where that cannot be said."""
    try:
        return inspect.signature(value)
    except (TypeError, ValueError):
        return None


def _detail(value) -> str:
    """The one line shown beside a name: what it takes, or what it is."""
    if value is _UNKNOWN:
        return ""
    if isinstance(value, types.ModuleType):
        return "module"
    if inspect.isroutine(value) or isinstance(value, type):
        signature = _signature_of(value)
        name = getattr(value, "__name__", "")
        return _clip(f"{name}{signature}", DETAIL_LIMIT) if signature else name
    return type(value).__name__


def completions(source: str, namespace: dict) -> dict:
    """What could finish the word at the end of ``source``.

    Parameters
    ----------
    source : str
        Everything written up to the caret.  Only its tail matters, but the whole of it
        is accepted so the caller never has to decide where a word began.
    namespace : dict
        The names the session is holding.

    Returns
    -------
    dict
        ``items`` is a list of ``{label, kind, detail}``, and ``from`` is the offset in
        ``source`` that the chosen label replaces.

    Examples
    --------
    >>> completions("import math\\nmath.at", {"math": __import__("math")})["items"][0]
    {'label': 'atan', 'kind': 'function', 'detail': 'atan(x, /)'}
    """
    start = _word_start(source)
    word = source[start:]
    completer = rlcompleter.Completer(namespace)

    if "." in word:
        dot = word.rindex(".")
        owner = _evaluate(word[:dot], namespace)
        start += dot + 1
        try:
            found = completer.attr_matches(word)
        except Exception:
            return {"items": [], "from": start}
        # An attribute match comes back as the whole dotted path; only the last part is
        # being typed, and only the last part is replaced.
        names = [match.rpartition(".")[2] for match in found]
    else:
        owner = None
        try:
            names = completer.global_matches(word)
        except Exception:
            return {"items": [], "from": start}

    items = []
    for name in dict.fromkeys(_bare(n) for n in names):
        if not name:
            continue
        value = _member(owner, name, namespace)
        items.append({"label": name, "kind": _kind(value, name), "detail": _detail(value)})
        if len(items) >= LIMIT:
            break
    return {"items": items, "from": start}


def _open_call(source: str):
    """The bracket the caret is inside, as ``(index, argument number)``.

    Brackets inside strings are not brackets, so the text is read rather than counted.
    """
    stack = []
    quote = ""
    index = 0
    while index < len(source):
        char = source[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = ""
        elif char in "\"'":
            quote = char
        elif char in "([{":
            stack.append([index, char, 0])
        elif char in ")]}":
            if stack:
                stack.pop()
        elif char == "," and stack:
            stack[-1][2] += 1
        index += 1

    for opened, char, commas in reversed(stack):
        if char == "(":
            return opened, commas
    return None


def _summary(doc: str) -> str:
    """The opening paragraph of a docstring."""
    lines = []
    for line in inspect.cleandoc(doc).split("\n"):
        if not line.strip() and lines:
            break
        lines.append(line)
    return _clip("\n".join(lines), DOC_LIMIT)


def _parameter_doc(doc: str, name: str) -> str:
    """What a docstring says about one parameter, where it says anything.

    Documentation is written as ``name : type`` with the description indented under it,
    which is the form the solver's own documentation uses; the entry for the argument
    being written is worth more than the summary of the whole call.
    """
    lines = inspect.cleandoc(doc).split("\n")
    head = re.compile(rf"^{re.escape(name)}\s*:")
    for i, line in enumerate(lines):
        if not head.match(line.strip()) or line != line.lstrip():
            continue
        entry = [line]
        for following in lines[i + 1 :]:
            if following.strip() and following == following.lstrip():
                break
            entry.append(following)
        return _clip("\n".join(entry), DOC_LIMIT)
    return ""


def signature(source: str, namespace: dict) -> dict:
    """What the call being written takes.

    Parameters
    ----------
    source : str
        Everything written up to the caret.
    namespace : dict
        The names the session is holding.

    Returns
    -------
    dict or None
        ``label`` is the call written out, ``parameter`` names the argument the caret is
        in, and ``doc`` is what the documentation says about that argument, falling back
        to the opening of the whole docstring.  None where the caret is in no call, or
        the thing being called cannot be found.
    """
    opened = _open_call(source)
    if opened is None:
        return None
    at, argument = opened

    match = CALLEE.search(source[:at])
    if match is None:
        return None
    name = match.group(1)
    value = _evaluate(name, namespace)
    if value is _UNKNOWN:
        return None

    # A class is called to make one of itself, so what its brackets take is what its
    # __init__ takes.
    parameters = _signature_of(value)
    if parameters is None:
        return None

    named = [
        p.name
        for p in parameters.parameters.values()
        if p.kind is not inspect.Parameter.VAR_KEYWORD
    ]
    # Naming the argument by position stops at the first one given by keyword, which is
    # as far as position means anything.
    written = source[at + 1 :]
    by_keyword = re.search(r"[(,]\s*[A-Za-z_]\w*\s*=", "," + written) is not None
    parameter = "" if by_keyword or argument >= len(named) else named[argument]

    doc = inspect.getdoc(value) or ""
    detail = _parameter_doc(doc, parameter) if parameter else ""
    return {
        "label": f"{name}{parameters}",
        "parameter": parameter,
        "doc": detail or _summary(doc),
    }
