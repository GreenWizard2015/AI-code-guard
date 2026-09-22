import type { DirectCase, ProjectCase } from 'tests/language-parity/types';

export const DIRECT_CASES: DirectCase[] = [
	{ rule_id: 'dynamic-type', typescript: 'const Model = type("Model", {}, {});', python: 'Model = type("Model", (), {})' },
	{ rule_id: 'large-union', typescript: 'type Value = A | B | C | D;', python: 'def read(value: A | B | C | D) -> A:\n    return value' },
	{ rule_id: 'composite-state-type', typescript: 'type Value = A | B;', python: 'Value = A | B' },
	{ rule_id: 'composite-state-type', typescript: 'type Value = A & B;', python: 'Value = A & B' },
	{ rule_id: 'nullable-domain-type', typescript: 'class User { public value: string | null = null; }', python: 'class User:\n    value: str | None' },
	{ rule_id: 'broad-except', typescript: 'function read(): void { try {} catch {} }', python: 'def read():\n    try:\n        pass\n    except:\n        pass' },
	{ rule_id: 'multiple-result-shapes', typescript: 'function read(): unknown { return structuredContent; }', python: 'def read():\n    return structuredContent' },
	{ rule_id: 'ternary-expression', typescript: 'const value = ready ? load() : fallback();', python: 'value = load() if ready else fallback()' },
	{ rule_id: 'conditional-execution', typescript: 'const value = ready && load();', python: 'value = ready and load()' },
	{ rule_id: 'switch', typescript: 'switch (value) { case "a": break; default: break; }', python: 'match value:\n    case "a":\n        pass\n    case _:\n        pass' },
	{ rule_id: 'complex-default-parameter', typescript: 'function read(value = new Reader()): void {}', python: 'def read(value=Reader()):\n    pass' },
	{ rule_id: 'temporary-instance-method-call', typescript: 'function read(): Value { return new Reader().read(); }', python: 'def read():\n    return Reader().read()' },
	{ rule_id: 'single-item-array-state', typescript: 'function find_service(): Service[] { return []; }\nconst service = find_service()[0];', python: 'def find_service() -> list[Service]:\n    return []\nservice = find_service()[0]' },
	{ rule_id: 'complex-constructor', typescript: 'class Reader { public constructor() { this.prepare(); } }', python: 'class Reader:\n    def __init__(self):\n        self.prepare()' },
	{ rule_id: 'mutable-field-assignment', typescript: 'class Reader { public readonly value = 1; public set(): void { this.value = 2; } }', python: 'class Reader:\n    def __init__(self):\n        self.value = 1\n    def set(self):\n        self.value = 2' },
	{ rule_id: 'python-callable', typescript: 'function execute(service: Service): void { if (typeof service.run !== "function") { fallback(); } }', python: 'def execute(service: Service) -> None:\n    if not callable(service.run):\n        fallback()' },
	{ rule_id: 'proxy-callable', typescript: 'class Service { public run(value: Value): Value { return this._run(value); } }', python: 'class Service:\n    def run(self, value: Value):\n        return self._run(value)' },
	{ rule_id: 'getattr', typescript: 'function read(value: Value) { return getattr(value, "name"); }', python: 'def read(value):\n    return getattr(value, "name")' },
	{ rule_id: 'setattr', typescript: 'function write(value: Value) { setattr(value, "name", "value"); }', python: 'def write(value):\n    setattr(value, "name", "value")' },
	{ rule_id: 'tuple-type', typescript: 'function read(): readonly [string, number] { return ["", 1]; }', python: 'def read() -> tuple[str, int]:\n    return "", 1' },
];

export const ARCHITECTURE_CASES: DirectCase[] = [
	{ rule_id: 'empty-contract', typescript: 'interface Empty {}', python: 'from typing import Protocol\nclass Empty(Protocol):\n    pass' },
	{ rule_id: 'inline-generic-type', typescript: 'function read(value: Promise<{ id: string }>): void {}', python: 'def read(value: list[dict[str, str]]) -> str:\n    return ""' },
	{ rule_id: 'local-inheritance', typescript: 'class Parent {}\nclass Child extends Parent {}', python: 'class Parent:\n    pass\n\nclass Child(Parent):\n    pass' },
	{ rule_id: 'mixed-module', typescript: 'class Reader { public read(): number { return 1; } }\nfunction read(): number { return 1; }', python: 'class Reader:\n    def read(self):\n        return 1\n\ndef read():\n    return 1' },
	{ rule_id: 'stateless-class', typescript: 'class Reader { public read(): number { return 1; } }', python: 'class Reader:\n    def read(self):\n        return 1' },
	{ rule_id: 'procedural-class-name', typescript: 'class Reader { public read(): number { return 1; } }', python: 'class Reader:\n    def read(self):\n        return 1' },
	{ rule_id: 'attribute-depth', typescript: 'class Reader { public read(value: Value): unknown { return value.a.b.c.d.e; } }', python: 'class Reader:\n    def read(self, value: Value):\n        return value.a.b.c.d.e' },
	{ rule_id: 'naming', typescript: 'function BadName(): void { return; }', python: 'def BadName():\n    return' },
	{ rule_id: 'nested-class', typescript: 'class Outer { public inner = class Inner {}; }', python: 'class Outer:\n    class Inner:\n        pass' },
	{ rule_id: 'contract-fields', typescript: 'interface Store { value: string; }', python: 'from typing import Protocol\n\nclass Store(Protocol):\n    value: str' },
	{ rule_id: 'type-info', typescript: 'class Reader { public read(value: unknown): any { return value; } }', python: 'class Reader:\n    def read(self, value: Any) -> object:\n        return value' },
	{ rule_id: 'branch-duplication', typescript: 'function read(kind: string): void { if (kind === "a") { return; } else if (kind === "b") { return; } }', python: 'def read(kind):\n    if kind == "a":\n        return\n    elif kind == "b":\n        return' },
	{ rule_id: 'singleton', typescript: 'class Service {}\nconst service = new Service();', python: 'class Service:\n    pass\nservice = Service()' },
	{ rule_id: 'exception-grouping', typescript: 'class SingleError extends Error {}', python: 'class SingleError(Exception):\n    pass' },
];

export const PROJECT_CASES: ProjectCase[] = [
	{
		rule_id: 'dynamic-import',
		typescript: { 'sample.ts': 'function read() { return import("./reader"); }', 'reader.ts': 'export const value = 1;' },
		python: { 'sample.py': 'def read():\n    return __import__("reader")', 'reader.py': 'value = 1' },
	},
	{
		rule_id: 'nested-import',
		typescript: { 'sample.ts': 'function read() { import reader = require("./reader"); }', 'reader.ts': 'export const value = 1;' },
		python: { 'sample.py': 'def read():\n    import reader', 'reader.py': 'value = 1' },
	},
	{
		rule_id: 'late-import',
		typescript: { 'sample.ts': 'const value = 1;\nimport { read } from "./reader";', 'reader.ts': 'export const read = 1;' },
		python: { 'sample.py': 'value = 1\nimport reader', 'reader.py': 'value = 1' },
	},
	{
		rule_id: 'reexports',
		typescript: { 'sample.ts': 'export { read } from "./reader";', 'reader.ts': 'export const read = 1;' },
		python: { 'sample.py': 'from .reader import read', 'reader.py': 'read = 1' },
	},
	{
		rule_id: 'function-placement',
		typescript: { 'sample.ts': 'function read() { return 1; }' },
		python: { 'sample.py': 'def read():\n    return 1' },
	},
	{
		rule_id: 'file-function-count-info',
		typescript: { 'sample.ts': Array.from({ length: 11 }, (_, index) => `function read_${index}() { return ${index}; }`).join('\n') },
		python: { 'sample.py': Array.from({ length: 11 }, (_, index) => `def read_${index}():\n    return ${index}`).join('\n') },
	},
	{
		rule_id: 'class-field-import',
		typescript: { 'sample.ts': 'import { read } from "./reader";\nclass Service { public handler = read; }', 'reader.ts': 'export function read() { return 1; }' },
		python: { 'sample.py': 'from .reader import read\n\nclass Service:\n    handler = read', 'reader.py': 'def read():\n    return 1' },
	},
];
