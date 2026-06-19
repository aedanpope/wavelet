#!/usr/bin/env python3
"""Run the project's CommonJS *-test.js files using an embedded V8 (mini-racer).

This exists so the JS unit tests can be run in environments that have Python but
no Node.js (e.g. Claude Code web sessions). It is a developer convenience only;
CI still runs the tests on real Node via `npm run test:all`.

It provides a minimal CommonJS shim (require / module / exports / process /
console) and loads every root-level *.js file as a requireable module, so tests
that only use project code (no Node built-ins like fs/path/assert) run as-is.

Usage:
    pip install mini-racer
    python3 scripts/run-js-tests.py code-words-test.js [other-test.js ...]

Exit code is non-zero if any test file reports failure (process.exit(1)) or
throws, so it can gate a commit just like Node would.
"""
import glob
import json
import os
import sys

from py_mini_racer import MiniRacer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BOOTSTRAP = r"""
var __sources = SOURCES_JSON;
var __cache = {};
var __output = [];
var __exit = { code: 0, called: false };
var console = {
  log: function () { __output.push(Array.prototype.map.call(arguments, String).join(' ')); },
  error: function () { __output.push(Array.prototype.map.call(arguments, String).join(' ')); },
  warn: function () { __output.push(Array.prototype.map.call(arguments, String).join(' ')); }
};
var global = (typeof globalThis !== 'undefined') ? globalThis : this;
function __ExitError(code) { this.code = code; }
var process = {
  exit: function (code) { __exit.code = code | 0; __exit.called = true; throw new __ExitError(code | 0); },
  argv: [], env: {}, platform: 'v8'
};
function __norm(p) { return p.replace(/^\.\//, '').replace(/\.js$/, '') + '.js'; }
function require(p) {
  var key = __norm(p);
  if (__cache[key]) { return __cache[key].exports; }
  var src = __sources[key];
  if (src === undefined) { throw new Error('module not found: ' + p); }
  var module = { exports: {} };
  __cache[key] = module;
  var fn = new Function('module', 'exports', 'require', 'process', 'console', src);
  fn(module, module.exports, require, process, console);
  return module.exports;
}
function __run(entry) {
  __output = [];
  __exit = { code: 0, called: false };
  try {
    require(entry);
  } catch (e) {
    if (!(e instanceof __ExitError)) {
      __output.push('UNCAUGHT: ' + ((e && e.stack) || e));
      __exit.code = 1;
    }
  }
  return JSON.stringify({ output: __output, exitCode: __exit.code });
}
"""


def main(argv):
    entries = argv[1:]
    if not entries:
        print("usage: run-js-tests.py <test.js> [...]", file=sys.stderr)
        return 2

    sources = {}
    for path in glob.glob(os.path.join(ROOT, "*.js")):
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as fh:
            sources[name] = fh.read()

    overall = 0
    for entry in entries:
        name = os.path.basename(entry)
        if name not in sources:
            print(f"ERROR: {name} not found in {ROOT}", file=sys.stderr)
            overall = 2
            continue
        ctx = MiniRacer()
        ctx.eval(BOOTSTRAP.replace("SOURCES_JSON", json.dumps(sources)))
        result = json.loads(ctx.eval(f"__run({json.dumps(name)})"))
        print(f"\n===== {name} (exit {result['exitCode']}) =====")
        print("\n".join(result["output"]))
        overall = overall or result["exitCode"]
    return overall


if __name__ == "__main__":
    sys.exit(main(sys.argv))
