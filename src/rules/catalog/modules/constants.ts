export const MODULES_RULE_DATA = {
	"mixed-module": {
		message: "avoid mixing classes and functions in the same file",
		hint: "put the class and free functions in separate focused modules. Do not: mix two ownership models in one file.",
		priority: 6,
	},
	"unused-module-variable": {
		message: 'module variable "{name}" has no production usage',
		hint: "Remove the variable or add a real production usage. Do not: keep mutable module state without a consumer.",
		priority: 7,
	},
	"import-fan-out": {
		message: "module imports too many distinct modules",
		hint: "Split the module by cohesive responsibility or move composition wiring to a focused assembly module. Do not: bypass the limit by importing individual objects through aliases.",
		priority: 3,
	},
	"missing-import": {
		message: "Relative import cannot be resolved: {specifier}",
		hint: "restore the module or update the import to its current owner.",
		priority: 4,
	},
	"unused-file": {
		message: "Source file is not imported by any project source file",
		hint: "remove the unused file or add a real production/test import that uses it.",
		priority: 7,
	},
	reexports: {
		message: "avoid re-exporting imported symbols: {reason}",
		hint: "import from the defining module and use its real API at the call site. Do not: create a compatibility, barrel, or alias wrapper that only re-exports imports.",
		priority: 2,
	},
	"dynamic-import": {
		message: "avoid dynamic imports",
		hint: "use a module-level static import. Do not: load project modules with import(), require(), importlib.import_module(), or __import__().",
		priority: 4,
	},
	"nested-import": {
		message: "avoid nested imports",
		hint: "move the import to module scope and inject dependencies explicitly when needed. Do not: import inside functions, methods, classes, or conditional blocks.",
		priority: 4,
	},
	"relative-import": {
		message: "avoid relative imports",
		hint: "First configure the project import base at {project root} or {project root}/src, then replace relative imports with absolute module names. Do not: import project modules through ./, ../, or Python relative-import dots.",
		priority: 4,
	},
	"late-import": {
		message: "imports must be at the beginning of the file",
		hint: "move every static import to the module header, after the optional module docstring and future imports. Do not: place imports after executable statements or declarations.",
		priority: 4,
	},
	"single-class-file-name": {
		message: 'file with one class must use the file name "{expected_name}"',
		hint: "rename the file to the snake_case class name and keep its language extension. Do not: use kebab-case or hide the class behind an unrelated file name.",
		priority: 5,
	},
	"nested-class": {
		message: "nested classes are not allowed ({count})",
		hint: "Move each nested class to a focused top-level module or replace it with composition. Do not: hide a class inside another class or function.",
		priority: 8,
	},
	"class-field-import": {
		message: "class field {field} references imported function {name}",
		hint: "wrap the dependency in an instance method or inject it through the constructor. Do not: alias a function from another file as a class attribute.",
		priority: 5,
	},
	"module-placement": {
		message:
			"{target} ({members}) is imported from {importers}; {placement_message}. Suggested location(s): {suggestions}. {guidance}",
		hint: "Move {target} with {members} to the listed ownership locations. Importers: {importers}. Keep each listed class, protocol, type, constant, and function together.",
		priority: 7,
	},
	"directory-min-size": {
		message: "directory contains too few files (found {count})",
		hint: "move the module to its parent directory or merge it with a focused sibling. Do not: add placeholder files just to satisfy the directory structure.",
		priority: 7,
	},
	"ai-code-guard-directory-ignored": {
		message: ".ai-code-guard directory is not ignored by Git",
		hint: "Add .ai-code-guard/ to the project-root .gitignore so reports, caches, and review state are not committed.",
		priority: 7,
	},
	"directory-max-size": {
		message: "directory contains too many files (found {count})",
		hint: "split the directory by domain ownership or move one cohesive group into a child directory. Do not: add placeholder files or hide the size behind wrappers.",
		priority: 3,
	},
	"directory-max-source-subdirectories": {
		message: "directory contains too many source subdirectories (found {count})",
		hint: "group related source subdirectories under focused intermediate directories. Do not: count empty or test-only directories.",
		priority: 3,
	},
	"directory-class-min-size": {
		message: "directory contains too few classes (found {count})",
		hint: "move the module to its parent directory or group related classes in one focused sibling. Do not: add placeholder classes or files.",
		priority: 7,
	},
	"directory-class-max-size": {
		message: "directory contains too many classes (found {count})",
		hint: "hide implementation details one level below or move one cohesive group to a focused parent or child directory. Do not: add placeholder classes or files.",
		priority: 3,
	},
	"facade-file-content": {
		message: "facade file must contain only re-exports",
		hint: "keep index.ts, index.py, and __init__.py files limited to imports and re-exports. Move functions, classes, types, and values into implementation modules. Do not: put behavior or declarations in a facade file.",
		priority: 6,
	},
	"file-min-size": {
		message: "file is too short",
		hint: "keep the file focused enough to justify its existence, or merge it into a nearby module. Do not: leave a thin file wrapper just to split the code.",
		priority: 7,
	},
	"file-max-size": {
		message: "file is too large (found {count} raw lines)",
		hint: "split the file by ownership into focused modules. Do not: hide file size behind wrappers or generated-looking padding.",
		priority: 3,
	},
	"function-placement": {
		message: "module-level functions must be declared in the project-root functions file",
		hint: "FIRST move all functions to {project root}/functions.{ext}, then fix other problems. A cli.{ext} module may contain one entry-point function; keep all other behavior in domain classes. CLI startup wrappers may remain inline: use `if __name__ == '__main__':` in Python or `(function () { ... })();` in TypeScript.",
		priority: 7,
	},
	"cli-file-function-count": {
		message: "cli file contains more than one free function",
		hint: "Keep exactly one free entry-point function in cli.{ext}; move every other operation into focused domain classes. Do not: add multiple CLI entry points to one module.",
		priority: 7,
	},
	"functions-file-domain-class": {
		message: "functions file contains a free function",
		hint: "Move the function and its state into a focused domain class in a focused module, then remove the root functions file when it is empty. Do not: keep free functions or hide them behind a forwarding wrapper.",
		priority: 7,
	},
	"module-constants-separation": {
		message: "module-level constants must move to {target} or a focused file",
		hint: "Move module-level constants out of ordinary implementation files. Use constants.ts or constants.py, or a focused file when the constants belong together. Do not: keep module-level constants beside implementation code.",
		priority: 7,
	},
	"module-protocols-separation": {
		message: "module-level protocols must move to {target} or a focused file",
		hint: "Move module-level protocols out of ordinary implementation files. Use protocols.ts or protocols.py, or a focused file when the protocols belong together. Do not: keep module-level protocols beside implementation code.",
		priority: 7,
	},
	"constants-file-content": {
		message: "constants file must contain only constants (found {kind})",
		hint: "Keep constants.{ext} limited to constant values. Do not: declare functions, types, or classes in the constants file.",
		priority: 6,
	},
} as const;

export const PROJECT_ANALYSIS_RULE_IDS: ReadonlySet<string> = new Set(["missing-import", "unused-file"]);
