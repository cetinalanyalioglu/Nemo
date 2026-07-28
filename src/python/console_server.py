"""Run the Nemo console's Python on this machine instead of in the browser.

The browser carries its own interpreter and needs nothing installed, at the cost of
running one compiled to WebAssembly.  This serves the same console from the Python that
is already here -- the one with the solver installed, and its own compiler behind it --
and nothing about the prompt changes: the same ``nemo`` module, the same case document
crossing, the same results coming back.

Start it beside the app::

    python src/python/console_server.py

It prints an address carrying a token.  Paste that into the console's *local* runtime
field, and the prompt is served from here.

    Nemo console at http://127.0.0.1:8765/?token=b1946ac9...

The token is the whole of the access control and it matters: this executes whatever the
prompt sends, and a browser will let any page a user visits make requests to their own
machine.  A request without the token is refused, so a page that was never given the
address cannot reach this.  The socket is bound to the loopback interface as well, so
nothing off the machine can reach it at all.

Only the standard library is used, so this runs wherever the solver does.
"""

import argparse
import codeop
import json
import os
import secrets
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO

# Where the modules sit: beside this file, as the app keeps them.
HERE = os.path.dirname(os.path.abspath(__file__))
NEMO_MODULE = os.path.join(HERE, "nemo-module.py")
DISPLAY_MODULE = os.path.join(HERE, "display-shims.py")
SESSION_MODULE = os.path.join(HERE, "session.py")
HINTS_MODULE = os.path.join(HERE, "hints.py")

DEFAULT_PORT = 8765


def _load_module(name: str, source: str):
    """Import ``source`` under ``name``, as the browser's worker writes it to a file."""
    import importlib.util

    spec = importlib.util.spec_from_loader(name, loader=None)
    module = importlib.util.module_from_spec(spec)
    module.__dict__["__name__"] = name
    sys.modules[name] = module
    exec(compile(source, f"<{name}>", "exec"), module.__dict__)
    return module


class Session:
    """One interpreter, and the console semantics the prompt expects of it.

    Lines are pushed one at a time and the compiler decides when a block has ended, so
    an unfinished one keeps the prompt open exactly as it does in the browser.  A
    trailing expression echoes its value, and a failure comes back as the traceback
    with this file's own frames left out.
    """

    def __init__(self):
        self.namespace = {"__name__": "__main__", "__builtins__": __builtins__}
        self.compile = codeop.CommandCompiler()
        self.buffer = []
        self.host = None
        self.display = None
        self.session = None
        self.hints = None
        self.lock = threading.Lock()

    def bind(self, emit, show) -> None:
        """Point the bridge at the connection being served now.

        Boot and each submission arrive on requests of their own, and what they produce
        has to go back down the one that asked, so the two callbacks are re-pointed
        rather than fixed when the session starts.
        """
        self.host.emit = emit
        self.host.display = show

    def start(self, adapter: str) -> list:
        """Bring up the bridge and the model's adapter; return how it describes itself."""
        self.host = _load_module("_nemo_host", "caseJson = '{}'\n")

        with open(DISPLAY_MODULE) as fh:
            self.display = _load_module("_nemo_display", fh.read())
        with open(SESSION_MODULE) as fh:
            self.session = _load_module("_nemo_session", fh.read())
        with open(HINTS_MODULE) as fh:
            self.hints = _load_module("_nemo_hints", fh.read())
        with open(NEMO_MODULE) as fh:
            nemo = _load_module("nemo", fh.read())
        # As in a notebook, both are there before the first line rather than waiting to
        # be imported.
        self.namespace["nemo"] = nemo
        self.namespace["display"] = self.display.display

        if not adapter.strip():
            return []
        try:
            solver = _load_module("_nemo_solver", adapter)
        except Exception:
            sys.modules.pop("_nemo_solver", None)
            return ["the model's solver could not be loaded", traceback.format_exc().rstrip()]
        describe = getattr(solver, "describe", None)
        if describe is None:
            return []
        try:
            return [str(describe())]
        except Exception:
            return ["the model's solver did not describe itself"]

    def reset(self) -> None:
        """Abandon a half-entered block, leaving the names alone."""
        self.buffer.clear()

    def variables(self) -> list:
        """Every name the session holds."""
        return self.session.variables(self.namespace) if self.session else []

    def clear_variables(self) -> list:
        """Forget them all, and report what is left, which should be nothing."""
        if self.session:
            self.session.clear(self.namespace)
        return self.variables()

    def completions(self, source: str) -> dict:
        """What could finish the word at the end of ``source``."""
        if self.hints is None:
            return {"items": [], "from": 0}
        return self.hints.completions(source, self.namespace)

    def signature(self, source: str):
        """What the call being written takes, or None where there is no call."""
        return self.hints.signature(source, self.namespace) if self.hints else None

    def run_block(self, source: str) -> dict:
        """Run a whole cell.

        The same Python the browser's interpreter runs for a cell, so what a cell means
        cannot differ between the two.  It is written as a coroutine, since a cell may
        await at its top level as one in a notebook may; there is no loop running here,
        so one is made for it.
        """
        import asyncio

        loop = asyncio.new_event_loop()
        try:
            status = loop.run_until_complete(self.display.run_block(source, self.namespace))
        finally:
            loop.close()
        return {"status": status}

    def push(self, line: str) -> dict:
        """Feed one line in, and report how it ended.

        What it produced goes out through the display protocol as it happens, so the
        answer here is only ``complete``, ``incomplete`` or ``failed``.
        """
        self.buffer.append(line)
        source = "\n".join(self.buffer)
        try:
            compiled = self.compile(source, "<console>", "single")
        except (OverflowError, SyntaxError, ValueError):
            self.buffer.clear()
            self._report_error(syntax_only=True)
            return {"status": "failed"}
        if compiled is None:
            return {"status": "incomplete"}

        self.buffer.clear()
        return self._execute(compiled)

    def _execute(self, compiled) -> dict:
        """Run one compiled block, sending out what it prints and the value it leaves."""

        def displayhook(value):
            # 'single' mode hands every top-level expression here.  A value is asked
            # for every representation it can offer rather than just its repr, which is
            # what lets a figure be shown as a figure.
            if value is None:
                return
            sys.modules["builtins"]._ = value
            self.display.result(value)

        # A cell that has just imported plotly wants its figures shown here rather than
        # in a browser tab; the patch waits for the import, and this is when it is
        # looked for.
        self.display.apply_pending()

        stdout, stderr, hook = sys.stdout, sys.stderr, sys.displayhook
        sys.stdout = _Stream(self.display, "stdout")
        sys.stderr = _Stream(self.display, "stderr")
        sys.displayhook = displayhook
        try:
            exec(compiled, self.namespace)
        except SystemExit:
            raise
        except BaseException:
            return self._report_error()
        finally:
            sys.stdout, sys.stderr, sys.displayhook = stdout, stderr, hook
        return {"status": "complete"}

    def _report_error(self, syntax_only: bool = False) -> dict:
        """Send out the failure that is being handled, and report that there was one.

        The frames belonging to this server are dropped: what ran the block is the
        console's own business, not something the person at the prompt wrote.
        """
        kind, value, tb = sys.exc_info()
        if syntax_only:
            lines = traceback.format_exception_only(kind, value)
        else:
            entries = traceback.extract_tb(tb)
            # The first frame is _execute's own exec(); below it is the user's code.
            lines = ["Traceback (most recent call last):\n"]
            lines += traceback.format_list(entries[1:])
            lines += traceback.format_exception_only(kind, value)
        text = "".join(lines).rstrip()
        self.display.error(kind.__name__, str(value), text.split("\n"))
        return {"status": "failed"}


class _Stream(StringIO):
    """A stand-in for stdout or stderr that sends each write on as it happens."""

    def __init__(self, display, name):
        super().__init__()
        self._display = display
        self._name = name

    def write(self, text):
        if text:
            self._display.stream(self._name, text)
        return len(text)

    def flush(self):
        pass


class Handler(BaseHTTPRequestHandler):
    """The three requests the console makes, each answered by a stream of replies."""

    protocol_version = "HTTP/1.1"
    server_version = "NemoConsole/1"

    # Silence the default one-line-per-request log; the console is the interface here.
    def log_message(self, fmt, *args):
        pass

    def _cors(self) -> None:
        # The app is served from somewhere else -- a dev server, a static host -- so the
        # browser treats this as another origin.  The token, not the origin, is what
        # decides whether a request is answered.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-nemo-token")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):  # noqa: N802 - the name http.server dispatches on
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):  # noqa: N802 - the name http.server dispatches on
        if not secrets.compare_digest(self.headers.get("x-nemo-token", ""), self.server.token):
            self.send_response(403)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        length = int(self.headers.get("content-length", 0))
        message = json.loads(self.rfile.read(length) or b"{}")

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()

        try:
            self._dispatch(message)
        except (BrokenPipeError, ConnectionResetError):
            # The console went away mid-run -- a restart, or the page closed.
            return
        self._end_chunks()

    def _dispatch(self, message: dict) -> None:
        kind = message.get("kind")
        if kind == "boot":
            self._boot(message)
        elif kind == "run":
            self._run(message)
        elif kind == "reset":
            self.server.session.reset()
        elif kind == "workspace":
            self._reply({"kind": "workspace", "variables": self.server.session.variables()})
        elif kind == "clear-workspace":
            self._reply(
                {"kind": "workspace", "variables": self.server.session.clear_variables()}
            )
        elif kind == "complete":
            found = self.server.session.completions(message.get("source", ""))
            self._reply({"kind": "completions", "hintId": message.get("hintId"), **found})
        elif kind == "signature":
            self._reply(
                {
                    "kind": "signature",
                    "hintId": message.get("hintId"),
                    "hint": self.server.session.signature(message.get("source", "")),
                }
            )

    def _boot(self, message: dict) -> None:
        session = self.server.session
        self._reply({"kind": "booting", "step": "connecting to the local interpreter"})
        described = session.start(message.get("adapter", ""))
        session.bind(self._bridge, self._display(None))
        # Packages are not installed from here: this interpreter is the machine's own,
        # and what is in it is the user's business rather than the model's.
        self._reply(
            {
                "kind": "ready",
                "python": ".".join(str(v) for v in sys.version_info[:3]),
                "packages": described + ["on this machine"],
            }
        )

    def _run(self, message: dict) -> None:
        session = self.server.session
        run_id = message.get("runId")

        # One submission at a time: the interpreter has one set of names, and two runs
        # writing to them from different connections would interleave.
        with session.lock:
            session.bind(self._bridge, self._display(run_id))
            if session.host is not None:
                session.host.caseJson = message.get("caseJson", "{}")
            if message.get("mode") == "block":
                outcome = session.run_block(message.get("source", ""))
            else:
                outcome = {"status": "complete"}
                for line in message.get("source", "").split("\n"):
                    outcome = session.push(line)
                    if outcome["status"] == "failed":
                        break
        self._reply({"kind": "ran", "runId": run_id, "outcome": outcome})

    def _bridge(self, payload: str) -> None:
        """Something Python asked the canvas to do."""
        self._reply({"kind": "bridge", "call": json.loads(payload)})

    def _display(self, run_id):
        """A sink for this run's outputs, already in the shape a notebook stores them."""

        def show(payload: str) -> None:
            self._reply({"kind": "display", "runId": run_id, "output": json.loads(payload)})

        return show

    def _reply(self, payload: dict) -> None:
        """Send one reply as its own chunk, so the console sees it as it happens."""
        body = (json.dumps(payload) + "\n").encode()
        self.wfile.write(f"{len(body):X}\r\n".encode() + body + b"\r\n")
        self.wfile.flush()

    def _end_chunks(self) -> None:
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to listen on")
    parser.add_argument(
        "--token",
        default=None,
        help="the token the console must present; a fresh one is generated when omitted",
    )
    args = parser.parse_args()

    token = args.token or secrets.token_hex(16)
    # Loopback only: nothing off this machine should be able to reach an interpreter.
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.token = token
    server.session = Session()

    address = f"http://127.0.0.1:{args.port}/?token={token}"
    print("Nemo console, served from this machine.")
    print()
    print(f"    {address}")
    print()
    print("Paste that into the console's local-runtime field. Ctrl-C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
