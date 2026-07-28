"""What a value looks like when a notebook shows it.

A console that only prints is a console that cannot show a figure.  This is the other
half: every value is asked for the representations it can offer, and the richest one the
page knows how to draw is what appears.  It is the display protocol notebooks have used
for years, so a figure that draws in Jupyter draws here for the same reason and by the
same call.

Three things are installed on top of it, so that code written for a notebook runs in one
without being edited:

* ``display()``, and the ``IPython.display`` module it usually arrives from;
* a plotly renderer, so ``fig.show()`` shows the figure here rather than looking for a
  browser tab to open;
* ``get_ipython()``, reporting a host that can render, which is how libraries decide
  whether to hand over HTML or fall back to plain text.

The ``IPython`` this installs is a stand-in with the display half filled in and nothing
else.  It is installed whether or not the real one is importable, so that a prompt
behaves the same wherever it is being served from.
"""

import json
import sys
import types

import _nemo_host

# Representations a value may offer one at a time, in the order they are asked for.
# `_repr_mimebundle_` is asked first and can answer with all of them at once.
_REPR_METHODS = (
    ("_repr_html_", "text/html"),
    ("_repr_markdown_", "text/markdown"),
    ("_repr_svg_", "image/svg+xml"),
    ("_repr_png_", "image/png"),
    ("_repr_jpeg_", "image/jpeg"),
    ("_repr_latex_", "text/latex"),
    ("_repr_json_", "application/json"),
)

# Longest plain-text representation kept; a value that reprs to megabytes helps nobody.
TEXT_LIMIT = 4000


def bundle(value) -> dict:
    """Everything ``value`` can say about itself, keyed by media type.

    ``text/plain`` is always present, so a value is never unshowable -- a renderer that
    understands none of the rest still has something to print.
    """
    data = {}

    mimebundle = getattr(value, "_repr_mimebundle_", None)
    if mimebundle is not None:
        try:
            offered = mimebundle()
            # The protocol allows (data, metadata); only the data half is wanted here.
            if isinstance(offered, tuple):
                offered = offered[0]
            if isinstance(offered, dict):
                data.update(offered)
        except Exception:
            pass

    for method, mime in _REPR_METHODS:
        if mime in data:
            continue
        repr_method = getattr(value, method, None)
        if repr_method is None:
            continue
        try:
            offered = repr_method()
        except Exception:
            continue
        if offered is not None:
            data[mime] = offered

    if "text/plain" not in data:
        data["text/plain"] = _shorten(repr(value))
    return data


def _shorten(text: str) -> str:
    """``text`` with the middle taken out when it is longer than a pane can use."""
    if len(text) <= TEXT_LIMIT:
        return text
    half = TEXT_LIMIT // 2
    return f"{text[:half]}\n<... {len(text) - TEXT_LIMIT} more characters ...>\n{text[-half:]}"


def emit(output: dict) -> None:
    """Hand one output to whatever is showing this cell."""
    _nemo_host.display(json.dumps(output, default=str))


def display(*objects, **_kwargs) -> None:
    """Show each object now, rather than waiting for the end of the cell.

    The signature a notebook expects.  Keyword arguments it does not act on are taken
    and ignored, so a call written for a fuller host still runs.
    """
    for obj in objects:
        emit({"output_type": "display_data", "data": bundle(obj), "metadata": {}})


def result(value, count=None) -> None:
    """Show the value a cell ended on."""
    emit(
        {
            "output_type": "execute_result",
            "execution_count": count,
            "data": bundle(value),
            "metadata": {},
        }
    )


def stream(name: str, text: str) -> None:
    """Pass on something printed, as it is printed."""
    emit({"output_type": "stream", "name": name, "text": text})


def error(ename: str, evalue: str, traceback_lines) -> None:
    """Pass on a failure, with the traceback split as the format keeps it."""
    emit(
        {
            "output_type": "error",
            "ename": ename,
            "evalue": evalue,
            "traceback": list(traceback_lines),
        }
    )


# --------------------------------------------------------------------------- #
# Making notebook code run unchanged
# --------------------------------------------------------------------------- #
class _Rich:
    """A value that is nothing but one representation, as ``HTML("<b>x</b>")`` is."""

    def __init__(self, data):
        self.data = data

    def _repr_mimebundle_(self, **_kwargs):
        return {self.MIME: self.data}


class HTML(_Rich):
    MIME = "text/html"


class Markdown(_Rich):
    MIME = "text/markdown"


class Latex(_Rich):
    MIME = "text/latex"


class SVG(_Rich):
    MIME = "image/svg+xml"


class JSON(_Rich):
    MIME = "application/json"


class _Shell:
    """The host, as a library asking ``get_ipython()`` expects to find it.

    Only its name is ever read: the usual test is whether that name is the one a
    notebook kernel has, which is how a library decides to hand over HTML rather than
    plain text.  This host does render HTML, so it answers to that name.
    """


_Shell.__name__ = "ZMQInteractiveShell"
_SHELL = _Shell()


def get_ipython():
    """The running host.  Never ``None`` here -- something is always showing this."""
    return _SHELL


def _install_ipython() -> None:
    """Register the display half of ``IPython`` for code that imports it."""
    ipython = types.ModuleType("IPython")
    module = types.ModuleType("IPython.display")
    for name in ("display", "HTML", "Markdown", "Latex", "SVG", "JSON"):
        setattr(module, name, globals()[name])
    module.display_html = lambda data, **_kw: display(HTML(data))
    module.display_markdown = lambda data, **_kw: display(Markdown(data))
    module.clear_output = lambda **_kw: None

    ipython.display = module
    ipython.get_ipython = get_ipython
    sys.modules["IPython"] = ipython
    sys.modules["IPython.display"] = module


def _configure_plotly(plotly_io) -> None:
    """Make plotly hand its figures over rather than go looking for somewhere to put them.

    Two settings.  ``show`` is replaced, since its usual job is to find a browser tab and
    there is nothing to find here.  And the renderer is narrowed to the one that only
    describes the figure: the default also emits a script to fetch plotly's drawing code
    from a public address, which is both an output nobody asked to keep and a fetch this
    page has no need of -- it draws the figure itself, from the description.
    """

    def show(fig, *_args, **_kwargs):
        display(fig)

    plotly_io.show = show
    plotly_io.renderers.default = "plotly_mimetype"


# Settings to apply once the module they are for has been imported.  Waiting is what
# makes them free: a console that never draws a figure never imports plotly, and a
# figure cannot be shown before the cell that imported it has run.
_PENDING = {"plotly.io": _configure_plotly}


def apply_pending() -> None:
    """Apply any setting whose module has since appeared.  Called once per cell."""
    for module_name in list(_PENDING):
        module = sys.modules.get(module_name)
        if module is None:
            continue
        try:
            _PENDING[module_name](module)
        finally:
            # Once only, whether or not it took: a module that cannot be configured is
            # not going to become configurable by being asked again every cell.
            del _PENDING[module_name]


_install_ipython()
