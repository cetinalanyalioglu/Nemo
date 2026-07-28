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

# Where the bridge module sits: beside this file, as the app keeps them.
HERE = os.path.dirname(os.path.abspath(__file__))
NEMO_MODULE = os.path.join(HERE, "nemo-module.py")

# Longest repr echoed for a value, matching what the browser console shows.
REPR_LIMIT = 4000

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


def _shorten(text: str) -> str:
    """``text``, with the middle taken out when it is longer than the pane can use."""
    if len(text) <= REPR_LIMIT:
        return text
    half = REPR_LIMIT // 2
    return f"{text[:half]}\n<... {len(text) - REPR_LIMIT} more characters ...>\n{text[-half:]}"


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
        self.lock = threading.Lock()

    def start(self, adapter: str, emit) -> list:
        """Bring up the bridge and the model's adapter; return how it describes itself."""
        host = _load_module("_nemo_host", "caseJson = '{}'\n")
        host.emit = emit
        self.host = host

        with open(NEMO_MODULE) as fh:
            nemo = _load_module("nemo", fh.read())
        self.namespace["nemo"] = nemo

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

    def push(self, line: str, out) -> dict:
        """Feed one line in, and report what the interpreter made of it.

        ``out`` receives whatever is printed, as it is printed.
        """
        self.buffer.append(line)
        source = "\n".join(self.buffer)
        try:
            compiled = self.compile(source, "<console>", "single")
        except (OverflowError, SyntaxError, ValueError):
            self.buffer.clear()
            return {"status": "failed", "error": self._syntax_error()}
        if compiled is None:
            return {"status": "incomplete"}

        self.buffer.clear()
        return self._execute(compiled, out)

    def _execute(self, compiled, out) -> dict:
        """Run one compiled block, capturing what it prints and the value it leaves."""
        echoed = []

        def displayhook(value):
            # 'single' mode hands every top-level expression here; the prompt shows it
            # as a value rather than as printed output, so it is kept apart.
            if value is None:
                return
            builtins_module = sys.modules["builtins"]
            builtins_module._ = value
            echoed.append(_shorten(repr(value)))

        stdout, stderr, hook = sys.stdout, sys.stderr, sys.displayhook
        sys.stdout = _Stream(out, "out")
        sys.stderr = _Stream(out, "err")
        sys.displayhook = displayhook
        try:
            exec(compiled, self.namespace)
        except SystemExit:
            raise
        except BaseException:
            return {"status": "failed", "error": self._traceback()}
        finally:
            sys.stdout.flush()
            sys.stderr.flush()
            sys.stdout, sys.stderr, sys.displayhook = stdout, stderr, hook
        return {"status": "complete", "repr": echoed[-1] if echoed else None}

    def _traceback(self) -> str:
        """The traceback as the prompt should see it: without this server's frames."""
        kind, value, tb = sys.exc_info()
        entries = traceback.extract_tb(tb)
        # The first frame is _execute's own exec(); everything below it is the user's.
        lines = ["Traceback (most recent call last):\n"]
        lines += traceback.format_list(entries[1:])
        lines += traceback.format_exception_only(kind, value)
        return "".join(lines).rstrip()

    def _syntax_error(self) -> str:
        """A parse failure, formatted with the caret the prompt shows."""
        kind, value, _tb = sys.exc_info()
        return "".join(traceback.format_exception_only(kind, value)).rstrip()


class _Stream(StringIO):
    """A stand-in for stdout or stderr that forwards each write as it happens."""

    def __init__(self, emit, which):
        super().__init__()
        self._emit = emit
        self._which = which

    def write(self, text):
        if text:
            self._emit(self._which, text)
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

    def _boot(self, message: dict) -> None:
        session = self.server.session
        self._reply({"kind": "booting", "step": "connecting to the local interpreter"})
        described = session.start(
            message.get("adapter", ""),
            lambda payload: self._reply({"kind": "bridge", "call": json.loads(payload)}),
        )
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

        def out(which, text):
            self._reply({"kind": "output", "runId": run_id, "stream": which, "text": text})

        # One submission at a time: the interpreter has one set of names, and two runs
        # writing to them from different connections would interleave.
        with session.lock:
            if session.host is not None:
                session.host.caseJson = message.get("caseJson", "{}")
            outcome = {"status": "complete", "repr": None}
            for line in message.get("source", "").split("\n"):
                outcome = session.push(line, out)
                if outcome["status"] == "failed":
                    break
        self._reply({"kind": "ran", "runId": run_id, "outcome": outcome})

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
