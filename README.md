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

## Priority levels

| Priority | General scope |
| ---: | --- |
| 8 | Directory structure and ownership findings. A directory finding suppresses every other finding beneath that directory. |
| 7 | File location, placement, and naming findings. These precede and suppress findings about that file's contents. |
| 6 | High-impact code findings, including parse errors, hard structural bans, dead code, execution, test-observation, and type-safety risks. |
| 5 | Significant contracts and architecture problems without a direct runtime failure. |
| 4 | Non-critical test-safety, runtime-boundary, and maintainability problems. |
| 3 | Complexity, size, count, and other structural thresholds. |
| 2 | Naming, simple control-flow, duplication, and lightweight style conventions. |
| 1 | Informational counts and usage signals. |
| 0 | Editorial wording and source-text review. |

Diagnostics follow a repair hierarchy: resolve directory ownership and structure
first, then file location, placement, and naming, then code findings from broad
contracts and architecture down to local behavior, size, and style. A directory
finding hides all descendant findings; a file organization finding hides code
findings for that file. This keeps a report focused on the wider cause before
the issues that may be consequences of moving or restructuring code.


## Requirements

### System requirements

- Ubuntu or another Linux distribution;
- Node.js 18 or newer;
- `pnpm` 8 or newer;
- Python 3.10 or newer;
- `python3-venv` when using a virtual environment.

The Python bridge uses only the Python standard library at runtime. Development, tests, and CI checks use the packages listed in [`requirements.txt`](../requirements.txt).

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
pnpm test:runner
```

`pnpm test:runner` runs the Python tests first, then the Jest/TypeScript tests, followed by the configured formatters and quality checks.

For the repository test runner, which also installs dependencies and runs the
available formatters and quality checks, use:

```bash
pnpm test:runner
pnpm test:runner -- --headless
pnpm test:runner -- --skip-quality
```

Run the checks separately when debugging:

```bash
pnpm test:runner -- --runInBand
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

The formatter commands use the existing project defaults. Formatting and quality checks are part of `pnpm test:runner` unless `--skip-quality` is used.

## CLI usage

The CLI uses the process working directory as the default project root. To lint a different project, pass an absolute root explicitly:

```bash
pnpm --dir /absolute/path/to/AI-code-guard exec tsx \
  /absolute/path/to/AI-code-guard/src/core/cli.ts \
  --root /absolute/path/to/project
```

Available options:

```text
--root <path>
    Project root to scan. Relative paths are resolved from the directory
    where the command is started.

--ignore-dir <path>
    Exclude a directory from lint targets. Its source files remain in the
    production project graph for import resolution and test-target analysis.
    The option may be repeated.

--entry-file <path>
    Treat a project-relative file as an entry point. The option may be
    repeated.

--force-review
    Start the architecture review even when previous review files are complete
    and even when lint diagnostics exist. Diagnostics remain reported; this flag
    only removes them as a prerequisite for starting the review.

--review-agent <codex|cx|cxa|claude>
    Run the selected external architecture-review CLI. If no agent is selected,
    architecture review is skipped. `cx` and `cxa` use the local Codex
    account-switching wrapper.

--review-stage <boundaries|data-lifecycle|algorithms|tests|abstractions>
    Run ONLY the selected architecture-review stage. Repeat the option to select multiple stages.

--batch-size <number>
    Maximum number of distinct files included in a generated task or package.
    This is always a file count, never a finding count. With `--agents`, each
    package counts both production and test files. The default is 10. Linked test files stay
    with their production scope and count toward this limit. Packages target
    at least 10 files when possible; a nonempty selection with fewer than 10
    files still emits one nonempty package. A nonempty selection always emits
    at least one package.

--agents <number>
    Create up to this many non-overlapping task packages in
    `.ai-code-guard/agent-tasks/`. Packages keep resolver-linked production
    and test files together. Each package contains at most `--batch-size`
    distinct files, including linked test files; across `N` packages this is at
    most `N × --batch-size` files. The CLI creates fewer than `N` packages when
    that is the largest partition with 10–`--batch-size` files per package.
    If the selected set is larger than aggregate file capacity, files with
    higher-priority findings are retained first; findings in files not
    packaged remain visible in `issues.md` and are reported as excluded from
    packages. Existing
    folder assignments and package numbers are retained where possible; clean
    folders release their previous assignment. A nonempty selection always
    creates at least one package.

--policy <top-category|all>
    `top-category` selects files from the largest top-severity rule category
    after directory and file-placement suppression. `all` includes every
    remaining visible diagnostic across all rule categories. Directory findings
    suppress all descendant findings; file location, placement, and naming
    findings suppress content findings for that file. With `--agents`, the
    policy selects the complete remaining visible finding set; `issues.md`
    contains it all, while packages may omit findings from files beyond their
    total file capacity.

```

Examples:

```bash
pnpm --dir /absolute/path/to/AI-code-guard exec tsx \
  /absolute/path/to/AI-code-guard/src/core/cli.ts \
  --root /absolute/path/to/my-project \
  --review-agent codex \
  --ignore-dir generated \
  --ignore-dir vendor \
  --entry-file src/main.ts
```

The CLI also recognizes common entry points automatically:

- TypeScript/TSX files beginning with `#!/usr/bin/env node`;
- Python files with a `if __name__ == "__main__":` guard;
- Python package `__init__.py` files;
- exact root `functions.ts`, `functions.tsx`, and `functions.py` files;
- test and spec files.

## Ubuntu shortcut: `ai-code-guard` from any directory

The repository includes [`setup-ubuntu-bash.sh`](../setup-ubuntu-bash.sh), which installs the project dependencies and configures the global Bash function automatically. Run it once from the checkout:

```bash
chmod +x /absolute/path/to/AI-code-guard/setup-ubuntu-bash.sh
/absolute/path/to/AI-code-guard/setup-ubuntu-bash.sh
source ~/.bashrc
```

The script creates `.venv`, installs [`requirements.txt`](../requirements.txt), installs the Node dependencies, and adds an idempotent `ai-code-guard` function to `~/.bashrc`. It does not overwrite an existing shortcut block.

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

## Review mode

In this mode, the linter asks an AI assistant to review the project. The
assistant looks for important design and behavior problems that ordinary lint
rules may miss. It reads the code and tests, follows dependencies, checks error
paths, and looks for repeated work or missing abstractions.

This can use many provider tokens and can take much longer than a normal lint
run. Codex is the main tested integration. Claude is also available, but it
has not been tested as thoroughly, so its results and workflow may differ.

The review has five parts, which run at the same time:

- `boundaries` — ownership, coupling, cohesion, and dependency direction;
- `data-lifecycle` — state changes, ownership, mutation, and error handling;
- `algorithms` — repeated work, unnecessary traversal, and scalability;
- `tests` — missing important tests, duplicate tests, and outdated tests;
- `abstractions` — useful domain objects and simpler boundaries.

The assistant writes one Markdown file for each confirmed major problem in
`.ai-code-guard/review/`. Each finding must include evidence that can be
checked and a concrete fix. Duplicate, speculative, or insignificant findings
are not useful. The target is up to ten different findings, but the review
stops when there are no more confirmed problems. Resolved files stay in the
directory as history and are ignored on later runs.

Start a review with:

```bash
ai-code-guard --review-agent <codex|cx|cxa|claude>
```

The usual workflow is:

1. Run the linter and fix its diagnostics.
2. Start an AI review with `--review-agent`.
3. Read and fix the confirmed findings.
4. Run the linter again.

Use `--force-review` to start a new review even when there are existing review
files or lint diagnostics. A run without `--review-agent` skips architecture
review.

The linter keeps the assistant output in
`.ai-code-guard/agent-debug.log`. It does not copy instruction files into the
project review directory. If the assistant fails or produces invalid output,
the lint command fails and records the reason instead of claiming that the
review is complete.

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

Test files below root `tests/` mirror a source module and may use one or more
scope directories before the module or before the test file, for example
`tests/performance/load/payments/` or
`tests/payments/acceptance/uat/`. Root `__tests__/` is also supported.

docs/rules/                   Rule docs, with TypeScript and Python versions in language folders
```

The Python implementation is intentionally isolated in `src/python-bridge/`. The TypeScript process invokes the Python bridge with an absolute module path and exchanges JSON data through standard input/output. Python tests import the bridge modules directly, while TypeScript tests verify the cross-language integration.

## Rule documentation

Rule documents live in `docs/rules/typescript/` and `docs/rules/python/`.
Shared rules have a separate document for each language; language-specific
rules have only their applicable version. The diagnostic registry in
`src/constants.ts` declares the rule's language scope, and the documentation
validator checks that every required version exists and contains examples in
the correct language.

Every TypeScript or Python example must end with a `cli.ts` or `cli.py` file.
The validator expands Markdown templates, then runs each example and requires
exit code `0` plus non-empty stdout. Output must come from an imported
implementation module; the CLI entrypoint itself must not write to stdout.
Examples use virtual source files and a time limit. Before execution, the
validator rejects external imports and filesystem, network, process, and
dynamic-code access. Python examples also run with restricted builtins.

Each run creates `.ai-code-guard` in the project root. The selected task is
written to `.ai-code-guard/issues.md`, and the referenced rule documents are
copied to `.ai-code-guard/rules/`. The complete rule summary is written to
`.ai-code-guard/report.md`. Review notes may be placed in
`.ai-code-guard/review/`. After the code is clean, use
`--review-agent codex`, `cx`, `cxa`, or `claude`; the linter starts only the
selected CLI and presents one review note at a time. `cx` and `cxa` are
account-switching Codex wrappers that can continue through another configured
Codex account when one reaches its usage limit.

## Development workflow

The project uses the AST linter together with TypeScript, Ruff, and mypy checks.
These tools catch different classes of errors, so I recommend running the same
checks on other projects that use TypeScript or Python as well.

Ruff checks every discovered Python source file with its full rule set and
argument checks. It runs isolated from Ruff configuration files and ignores
only rules that conflict with this project's own contracts:

```bash
# AI Code Guard
ai-code-guard

# TypeScript
pnpm exec tsc --noEmit
pnpm exec biome lint --reporter=summary --max-diagnostics=none .

# Python lint
python3 -m ruff check --isolated --select ALL --extend-select ARG --ignore D101,D102,D103,D105,D106,D107,FBT001,FBT002,N803,PT009 .

# Python types
python3 -m mypy --strict --extra-checks --warn-unreachable --explicit-package-bases .

ai-code-guard --review-agent <codex|cx|cxa|claude>
```

The ignored rules cover docstring-presence checks where the linter requires
Responsibilities docstrings, boolean-argument checks that reject a permitted
single boolean parameter, uppercase parameter naming covered by the naming
rule, and pytest-style assertions that conflict with the required unittest
style.

Mypy also checks every discovered Python source file, including tests and
performance tooling. The test runner adds the bridge and test-support
directories to `MYPYPATH`.

`--warn-unreachable` reports branches mypy can prove unreachable. Strict type
checking and import following catch type inconsistencies across module
boundaries that the AST linter cannot infer from syntax alone.

For a normal change, use this sequence:

```bash
pnpm type-check
pnpm test:runner
pnpm lint
git diff --check
```

`pnpm install` activates the versioned `.githooks/pre-commit` hook. Before every commit it runs
`pnpm test:runner -- --headless`; because no review agent is specified, architecture review is skipped.
A failing test, quality check, or lint check blocks the commit. Git hooks and GitHub Actions run without an agent;
select `--review-agent codex`, `cx`, `cxa`, or `claude` explicitly to request review.

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

## Performance benchmark

The following benchmark measures AI-code-guard against its own repository with
architecture review disabled. Each series contains 10 measured runs.

Results recorded on 2026-11-09:

| Mode | Average | Median | Files/sec |
| --- | ---: | ---: | ---: |
| **Date: 2026-10-19 Files: 1141 (892 TypeScript files and 249 Python files)** | | | |
| Without cache | 15.912 sec | 15.920 sec | 71.7 |
| With cache | 1.353 sec | 1.350 sec | 843.3 |
| **Date: 2026-10-21 Files: 1131 (911 TypeScript files and 220 Python files)** | | | |
| Without cache | 16.546 sec | 16.610 sec | 68.4 |
| With cache | 1.325 sec | 1.320 sec | 853.6 |
| **Date: 2026-11-09 Files: 1753 (1431 TypeScript files and 322 Python files)** | | | |
| Without cache | 31.205 sec | 31.190 sec | 56.2 |
| With cache | 2.469 sec | 2.460 sec | 710.0 |
