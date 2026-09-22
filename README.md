# AI Code Guard

AI Code Guard is a deliberately strict static linter for TypeScript and Python projects. It is designed to make code ownership, state transitions, module boundaries, and architectural intent explicit. The rules are stricter than standard style guides and are intended for projects where long-term structure and predictable maintenance matter more than minimizing the number of files or abstractions.

The linter analyzes TypeScript with the TypeScript AST and analyzes Python with a dedicated Python `ast` bridge. Diagnostics are emitted with a rule ID, source location, severity, message, hint, and a link to the rule documentation.

## Design goals

AI Code Guard focuses on structural problems that are easy to introduce during fast development or AI-assisted development:

- oversized files, classes, methods, and functions;
- unclear ownership between classes, modules, and callers;
- mutable state hidden behind broad helpers or object-shaped namespaces;
- excessive inheritance, proxy methods, and temporary instances;
- nullable domain types and overly broad unions;
- dynamic type construction and reflection-based control flow;
- misplaced free functions;
- unsafe or ambiguous test shapes;
- Python-specific control-flow, import, constructor, and private-access patterns;
- TypeScript and Python import, reference, symbol, and callable relationships.

The project intentionally favors focused classes, explicit interfaces, small ownership boundaries, and direct data flow. Some rules are opinionated and may be too strict for a conventional application. Treat the rule set as an architectural policy, not as a general-purpose formatter.

## Rule philosophy

AI Code Guard treats code structure as part of the domain contract. Its rules are intended to keep ownership, state transitions, and boundaries explicit across both TypeScript and Python:

- Use concrete, named contracts. Prefer focused interfaces, protocols, and value types over `any`, `unknown`, broad nullable boundaries, tuples, dynamic types, and anonymous shapes.
- Give every behavior a real owner. Use a cohesive class, module, or narrow boundary instead of procedural classes, namespace-shaped objects, singletons, mixins, proxy methods, or temporary instances.
- Make lifecycle and mutation visible. Prefer composition and dependency injection; avoid hidden state transitions, reflection, dynamic attribute access, deep forwarding chains, and business work in constructors.
- Let the file system express architecture. Keep one clear owner per file, separate constants, types, and protocols, keep facades to re-exports, and use static top-level imports.
- Treat tests as behavior specifications. Tests should verify real results at a public boundary, use the declared framework shape, remain small and atomic, and avoid logging, type-only checks, and implementation-detail assertions.
- Split responsibility when size, method count, parameter count, or nesting becomes excessive. Refactor the ownership boundary instead of hiding complexity behind wrappers or padding.
- Fix the architectural cause before the local symptom. Rule exceptions, artificial code, and other ways of bypassing diagnostics are not considered valid fixes. Informational rules are review signals; critical rules protect contracts and architecture.

## Priority levels

| Priority | General scope |
| ---: | --- |
| 7 | Critical placement, missing/unused code, and size violations. |
| 6 | Critical test, type-safety, and architecture violations. |
| 5 | Type, contract, ownership, and responsibility-boundary violations. |
| 4 | Import, runtime, proxy, and dynamic-access restrictions. |
| 3 | Size, complexity, count, and architectural threshold violations. |
| 2 | Naming, simple control-flow, and low-cost structural conventions. |
| 1 | Informational counts and usage signals. |
| 0 | Responsibility wording review. |

## Requirements

### System requirements

- Ubuntu or another Linux distribution;
- Node.js 18 or newer;
- `pnpm` 8 or newer;
- Python 3.10 or newer;
- `python3-venv` when using a virtual environment.

The Python bridge uses only the Python standard library at runtime. The development and test commands use the packages listed in [`requirements.txt`](requirements.txt): `pytest`, `black`, and `coverage`.

## Installation

Install the JavaScript dependencies from the project root:

```bash
pnpm install
```

Create and activate a Python virtual environment, then install the Python requirements:

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

The virtual environment is not required by the bridge itself, but it keeps test and formatting tools isolated from the system Python installation.

## Quick start

Run the linter against the current project directory:

```bash
pnpm lint
```

Run the complete test suite:

```bash
pnpm test
```

`pnpm test` runs the Python tests first, then the Jest/TypeScript tests. Its `posttest` hook runs the coding lint, so a successful command verifies both behavior and project structure.

For the repository test runner, which also installs dependencies and runs the
available formatters and quality checks, use:

```bash
pnpm test:runner
pnpm test:runner -- --headless
pnpm test:runner -- --skip-quality
```

Run the checks separately when debugging:

```bash
pnpm test:python
pnpm exec jest --runInBand
pnpm type-check
pnpm lint
```

Measure TypeScript and Python coverage, including Python bridge processes
launched by TypeScript:

```bash
pnpm coverage
```

The Jest report, Python JSON report, and list of uncovered Python statements
are written to `coverage/`. The Python HTML report is written to `htmlcov/`.
Temporary parallel coverage files are also kept in `coverage/`.

Format the supported source files:

```bash
pnpm format
```

The formatter commands use the existing project defaults. Formatting is not part of `pnpm test`.

## CLI usage

The CLI uses the process working directory as the default project root. To lint a different project, pass an absolute root explicitly:

```bash
pnpm --dir /absolute/path/to/AI-code-guard exec tsx \
  /absolute/path/to/AI-code-guard/src/bridge/ts/core/cli.ts \
  --root /absolute/path/to/project
```

Available options:

```text
--root <path>
    Project root to scan. Relative paths are resolved from the directory
    where the command is started.

--ignore-dir <path>
    Ignore a directory while discovering project files. The option may be
    repeated.

--entry-file <path>
    Treat a project-relative file as an entry point. The option may be
    repeated.

--timings
    Print all linter stage durations, including nested durations for every
    analyzed TypeScript and Python file. Nested entries include their
    percentage of the immediate parent duration.

--batch-size <number>
    Maximum number of files included in the generated task. The default is 10.

--policy <top-category|all>
    Select files from the largest top-severity rule category (the default), or
    include files from all top-severity categories.

```

Examples:

```bash
pnpm --dir /absolute/path/to/AI-code-guard exec tsx \
  /absolute/path/to/AI-code-guard/src/bridge/ts/core/cli.ts \
  --root /absolute/path/to/my-project \
  --ignore-dir generated \
  --ignore-dir vendor \
  --entry-file src/main.ts
```

To lint only selected files, set `CODING_LINT_FILES` to a comma-separated list
of paths relative to the project root:

```bash
CODING_LINT_FILES=src/main.ts,tests/main.test.ts pnpm lint
```

The CLI also recognizes common entry points automatically:

- TypeScript/TSX files beginning with `#!/usr/bin/env node`;
- Python files with a `if __name__ == "__main__":` guard;
- Python package `__init__.py` files;
- exact root `functions.ts`, `functions.tsx`, and `functions.py` files;
- test and spec files.

## Ubuntu shortcut: `ai-code-guard` from any directory

The repository includes [`setup-ubuntu-bash.sh`](setup-ubuntu-bash.sh), which installs the project dependencies and configures the global Bash function automatically. Run it once from the checkout:

```bash
chmod +x /absolute/path/to/AI-code-guard/setup-ubuntu-bash.sh
/absolute/path/to/AI-code-guard/setup-ubuntu-bash.sh
source ~/.bashrc
```

The script creates `.venv`, installs [`requirements.txt`](requirements.txt), installs the Node dependencies, and adds an idempotent `ai-code-guard` function to `~/.bashrc`. It does not overwrite an existing shortcut block.

The shortcut uses absolute paths for the linter installation and passes the directory where the command was invoked as the project root. This means the same command can lint any project without changing directory first.

Now run it from any project directory:

```bash
cd /absolute/path/to/my-project
ai-code-guard
```

You can pass the normal CLI options:

```bash
ai-code-guard --ignore-dir build --ignore-dir vendor --entry-file src/main.ts
```

If Bash is not your login shell, put the same function in the startup file used by your shell, such as `~/.zshrc`, and reload that file.

## Project structure

```text
src/
├── bridge/ts/
│   ├── core/                 CLI, reporting, run construction, Python bridge
│   ├── parser/               TypeScript-facing AST and source analysis
│   ├── rules/                TypeScript and shared rule support
│   └── runner/               File and project orchestration
├── metrics/                  Shared callable, class, and parameter metrics
├── parser/
│   ├── python-bridge/        Python AST parser and Python rule collectors
│   └── ts/                   TypeScript parser data and violation model
├── rules/typescript/          TypeScript rule context and defaults
└── runner/                   Project context and source scanning

tests/
├── core/                     TypeScript/Jest integration and unit tests
└── python/                   Python bridge tests

docs/rules/                   One document for each diagnostic rule
```

The Python implementation is intentionally isolated in `src/parser/python-bridge/`. The TypeScript process invokes the Python bridge with an absolute module path and exchanges JSON data through standard input/output. Python tests import the bridge modules directly, while TypeScript tests verify the cross-language integration.

## Rule documentation

The complete rule index is in [`docs/rules/README.md`](docs/rules/README.md). Each rule document describes its purpose, detection boundary, examples, and intended refactoring direction.

The report includes an absolute path to the relevant rule document. If a critical placement diagnostic is present, start with [`function-placement`](docs/rules/function-placement.md), move the free functions, and then rerun the linter.

Each run creates `.ai-code-guard` in the project root. The selected task is
written to `.ai-code-guard/issues.md`, and the referenced rule documents are
copied to `.ai-code-guard/rules/`. The complete rule summary is written to
`.ai-code-guard/report.md`. Review notes may be placed in
`.ai-code-guard/review/`; after the code is clean, the linter presents one
review note at a time.

## Development workflow

For a normal change, use this sequence:

```bash
pnpm test:python
pnpm type-check
pnpm test
pnpm lint
git diff --check
```

Keep tests focused on returned values and collected diagnostics. Test code should not mock console output to verify behavior. Python tests should use test methods on test classes, and TypeScript/Jest tests should follow the repository's one-suite-per-file and no-nested-suite conventions.

When a file or class becomes too large, split it by ownership. Prefer focused classes that own shared data and operations over collections of unrelated free functions. Free functions belong only in the exact project-root `functions.*` file.

## Current limitations

- The rules are intentionally opinionated and may require adaptation for frameworks with generated code or convention-heavy lifecycle APIs.
- React and Next.js-specific patterns are not a primary detection target.
- Dynamic metaprogramming can be detected only where it is visible in the AST.
- The linter does not replace type checking, formatting, security scanning, or runtime tests.
- The Python rules are almost certainly a poor fit for TensorFlow projects, whose generated graphs, tensors, decorators, and dynamic APIs do not match this linter's class-oriented architecture policy.

## License and status

This repository is a private project configuration and rule set. The rules evolve as new structural patterns are found in production code and AI-assisted changes.
