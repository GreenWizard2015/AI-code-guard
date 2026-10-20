export const GROUPED_PROTOCOL_FILES = {
	"protocols.py": [
		"from typing import Protocol",
		"",
		"class First(Protocol):",
		"    def run(self) -> None: ...",
		"",
		"class Second(Protocol):",
		"    def stop(self) -> None: ...",
	].join("\n"),
};

export const COMPOSITION_FILES = {
	"composition-root.ts":
		"import { CompositionMiddle } from './composition-middle';\nexport const CompositionRoot = class CompositionRoot {\n  private readonly middle = new CompositionMiddle();\n};",
	"composition-middle.ts":
		"import { CompositionLeaf } from './composition-leaf';\nexport const CompositionMiddle = class CompositionMiddle {\n  private readonly leaf = new CompositionLeaf();\n};",
	"composition-leaf.ts":
		"import { CompositionEnd } from './composition-end';\nexport const CompositionLeaf = class CompositionLeaf {\n  private readonly end = new CompositionEnd();\n};",
	"composition-end.ts": [
		"export const CompositionEnd = class CompositionEnd {",
		"  run() {",
		Array.from({ length: 14 }, (_, index) => `    const value${index} = ${index};`).join("\n"),
		"  }",
		"};",
	].join("\n"),
};

export const PYTHON_STATE_ANALYSIS_FILES = {
	"nested.ts": [
		"function nested(value: boolean): number {",
		"    if (value) {",
		"        for (const item of values) {",
		"            while (item.ready) {",
		"                try {",
		"                    return item.value;",
		"                } catch {",
		"                    return 0;",
		"                }",
		"            }",
		"        }",
		"    }",
		"    return 0;",
		"}",
	].join("\n"),
	"nested.py": [
		"def nested(value: bool) -> int:",
		"    if value:",
		"        for item in values:",
		"            while item.ready:",
		"                try:",
		"                    return item.value",
		"                except Exception:",
		"                    return 0",
		"    return 0",
	].join("\n"),
	"assignment-expressions.py": ["value = 1", "if (value := 2):", "    value += 1"].join("\n"),
	"primitive-ternaries.py": [
		"value = 1 if enabled else 0",
		"result = make_value() if enabled else fallback",
		"typed: str = make_value() if enabled else fallback",
	].join("\n"),
	"primitive-ternaries.ts": [
		"const value = enabled ? 1 : 0;",
		"const result = enabled ? makeValue() : fallback;",
		"const typed: string = makeValue() ? makeValue() : fallback;",
	].join("\n"),
	"tests/fixture_complexity_test.py": [
		"import unittest",
		"class FixtureTests(unittest.TestCase):",
		"    def setUp(self) -> None:",
		[
			"create_database()",
			"configure_transport()",
			"load_environment()",
			"register_routes()",
			"seed_users()",
			"seed_messages()",
			"connect_clients()",
			"configure_browser()",
			"configure_logger()",
			"configure_metrics()",
			"configure_clock()",
			"configure_randomness()",
			"configure_cleanup()",
			"configure_assertions()",
			"configure_retry()",
			"configure_observers()",
		]
			.map((line) => `        ${line}`)
			.join("\n"),
		"    def test_result(self) -> None:",
		"        self.assertTrue(True)",
	].join("\n"),
	"branch-count.ts": [
		"function choose(value: number): number {",
		Array.from({ length: 11 }, (_, index) => `    if (value === ${index}) { return ${index}; }`).join("\n"),
		"    return -1;",
		"}",
	].join("\n"),
	"branch_count.py": [
		"def choose(value: int) -> int:",
		Array.from({ length: 11 }, (_, index) => `    if value == ${index}: return ${index}`).join("\n"),
		"    return -1",
	].join("\n"),
	"nested-branch.ts": [
		"function outer(value: number): number {",
		"    if (value < 0) { return -1; }",
		"    function inner(input: number): number {",
		Array.from({ length: 11 }, (_, index) => `        if (input === ${index}) { return ${index}; }`).join("\n"),
		"        return -1;",
		"    }",
		"    return inner(value);",
		"}",
	].join("\n"),
	"nested_branch.py": [
		"def outer(value: int) -> int:",
		"    if value < 0:",
		"        return -1",
		"    def inner(input: int) -> int:",
		Array.from({ length: 11 }, (_, index) => `        if input == ${index}: return ${index}`).join("\n"),
		"        return -1",
		"    return inner(value)",
	].join("\n"),
	"lambda_branch.py": [
		"def outer(value: int) -> int:",
		`    chooser = lambda item: ${Array.from({ length: 11 }, (_, index) => `0 if item == ${index} else `).join("")}-1`,
		"    return chooser(value)",
	].join("\n"),
};

export const SINGLETON_FILES = {
	"singleton.ts": [
		"class Service {}",
		"const service = new Service();",
		"const controller = build_controller();",
		"function resolve_controller_options() { return new Service(); }",
		"function create_dom_controller() { return resolve_controller_options(); }",
		"export const CHATGPT_DOM_CONTROLLER = create_dom_controller();",
		"function build_controller() { return 1; }",
		"function build_service() { return new Service(); }",
		"const built = build_service();",
		"function build() { return new Service(); }",
		"const external = new ExternalService();",
		"function build_external() { return new ExternalService(); }",
		"const external_built = build_external();",
	].join("\n"),
	"imported-singleton.ts": "import { ImportedService } from './service';\nconst imported = new ImportedService();",
	"service.ts": "export class ImportedService {}",
	"singleton.py": ["class Service:", "    pass", "service = Service()", "def build():", "    return Service()"].join(
		"\n",
	),
	"imported-singleton.py": "from service import ImportedService\nimported = ImportedService()",
	"service.py": "class ImportedService:\n    pass",
	"imported-singleton-lower.py":
		"from service import ImportedService as imported_service\ninstance = imported_service()",
	"imported-module-singleton.py": "import service\ninstance = service.ImportedService()",
	"imported-class-alias.py":
		"from service import ImportedService\nServiceAlias = ImportedService\ninstance = ServiceAlias()",
	"destructured-class-alias.py":
		"from service import ImportedService\ndestructured, ignored = (ImportedService, None)\ninstance = destructured()",
	"assigned-class-alias.ts":
		"class AssignedService {}\nconst AssignedAlias = AssignedService;\nconst assigned = new AssignedAlias();",
	"destructured-class-alias.ts":
		"class DestructuredService {}\nconst { DestructuredService: DestructuredAlias } = { DestructuredService };\nconst destructured = new DestructuredAlias();",
	"array-destructured-class-alias.ts":
		"class ArrayDestructuredService {}\nconst [ArrayAlias] = [ArrayDestructuredService];\nconst array_destructured = new ArrayAlias();",
	"namespace-class-alias.ts":
		"import * as service_module from './service';\nconst NamespaceAlias = service_module.ImportedService;\nconst namespace_instance = new NamespaceAlias();",
	"qualified-namespace-singleton.ts":
		"import * as service_module from './service';\nconst qualified = new service_module.ImportedService();",
};

export const CALLABLE_LIMIT_FILES = {
	"short-file.ts": "export const shortValue = 1;\n",
	"short-class.ts": [
		"export class ShortClass {",
		"  run() {",
		'    return "a deliberately long value that exceeds the callable character limit for this short method and keeps the metric boundary explicit";',
		"  }",
		"}",
	].join("\n"),
	"metrics.ts": [
		"export class Sample {",
		"  method(a: string, b: string, c: string, d: string, e: string, f: string) {",
		"    return a + b + c + d + e + f + a + b + c + d + e + f + a + b + c + d + e + f + a + b + c + d + e + f + a + b + c + d + e + f + a;",
		"  }",
		"}",
		"export function tiny() { return 1; }",
		Array.from({ length: 16 }, (_, index) => `export function grouped${index}() { return ${index}; }`).join("\n"),
		"export function _Agent_load() { return 1; }",
		"export function _Agent_save() { return 1; }",
	].join("\n"),
	"metrics.py": [
		"def too_many(a, b, c, d, e, f):",
		"    return a + b + c + d + e + f",
		Array.from({ length: 16 }, (_, index) => `def grouped_${index}(): return ${index}`).join("\n"),
		"def _Worker_start(): return 1",
		"def _Worker_stop(): return 1",
	].join("\n"),
	"imports.py": ["from module import (", "    _Dispatcher_send,", "    _Dispatcher_receive,", ")", "value = 1"].join(
		"\n",
	),
};

export const SHORT_CLASS_FILES = {
	"small-classes.ts": [
		"class First {",
		"  run() { return 1; }",
		"}",
		"class Second {",
		"  run() { return 2; }",
		"}",
	].join("\n"),
	"small-classes.py": [
		"class First:",
		"    def run(self):",
		"        return 1",
		"class Second:",
		"    def run(self):",
		"        return 2",
	].join("\n"),
};

export const SHARED_THRESHOLD_FILES = {
	"shared-types.ts": [
		"type RecordData = string;",
		"class Service {",
		"  first(data: RecordData) { return data + data + data; }",
		"  second(data: RecordData) { return data + data + data; }",
		"  third(data: RecordData) { return data + data + data; }",
		"  fourth(data: RecordData) { return data + data + data; }",
		"}",
		"function load(data: RecordData) { return data + data + data; }",
		"function save(data: RecordData) { return data + data + data; }",
		"function remove(data: RecordData) { return data + data + data; }",
		"function archive(data: RecordData) { return data + data + data; }",
	].join("\n"),
	"shared-types.py": [
		"class RecordData:",
		"    pass",
		"",
		"class Service:",
		"    def first(self, data: RecordData):",
		"        return data + data + data",
		"    def second(self, data: RecordData):",
		"        return data + data + data",
		"    def third(self, data: RecordData):",
		"        return data + data + data",
		"    def fourth(self, data: RecordData):",
		"        return data + data + data",
	].join("\n"),
};

export const SEPARATE_CLASS_FILES = {
	"mixed.ts": [
		"type SharedInput = string;",
		"class Service {",
		"  run(input: SharedInput) { return input; }",
		"  reset(input: SharedInput) { return input; }",
		"}",
		"function load(input: SharedInput) { return input; }",
		"function read(input: SharedInput) { return input; }",
	].join("\n"),
	"other.ts": [
		"type SharedInput = string;",
		"class OtherService {",
		"  run(input: SharedInput) { return input; }",
		"  reset(input: SharedInput) { return input; }",
		"}",
		"function save(input: SharedInput) { return input; }",
		"function write(input: SharedInput) { return input; }",
	].join("\n"),
};

export const METHOD_CANDIDATES_FILES = {
	"first.ts": [
		"type SharedInput = string;",
		"class Service {",
		"  first(input: SharedInput) { return input; }",
		"  second(input: SharedInput) { return input; }",
		"  third(input: SharedInput) { return input; }",
		"  fourth(input: SharedInput) { return input; }",
		"}",
	].join("\n"),
};

export const PROJECT_WIDE_PARAMETER_FILES = {
	"first.ts":
		"class RequestData {}\nfunction load(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
	"second.ts": [
		"function save(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
		"function update(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
		"function remove(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
	].join("\n"),
};

export const TYPE_OPERATION_FILES = {
	"type-operations.ts": [
		'type Selected = Pick<RecordData, "id">;',
		'type Field = RecordData["id"];',
		"type Combined = RecordData & { value: string };",
		"type JsonMap = Record<string, unknown>;",
		"function read(input: Selected) { return input; }",
	].join("\n"),
	"tests/type-operations.ts": 'type Selected = Pick<RecordData, "id">;',
};

export const EXTERNAL_TYPE_FILES = {
	"external-types.ts": [
		"class Service {",
		"  first(element: HTMLElement) { return element && element && element; }",
		"  second(element: HTMLElement) { return element && element && element; }",
		"  third(element: HTMLElement) { return element && element && element; }",
		"  fourth(element: HTMLElement) { return element && element && element; }",
		"}",
		"function text_first(value: String) { return value + value; }",
		"function text_second(value: String) { return value + value; }",
	].join("\n"),
	"simple-types.py": [
		"def first(value: JSON):",
		'    return value.get("first") + value.get("second")',
		"",
		"def second(value: JSON):",
		'    return value.get("first") + value.get("second")',
		"",
		"def third(value: JSON):",
		'    return value.get("first") + value.get("second")',
		"",
		"def dict_first(value: dict):",
		'    return value.get("first") + value.get("second")',
		"",
		"def dict_second(value: dict):",
		'    return value.get("first") + value.get("second")',
	].join("\n"),
	"generic-types.ts": [
		"class GenericService {",
		"  first(value: Promise<Result>) { return value && value && value; }",
		"  second(value: Promise<Result>) { return value && value && value; }",
		"  third(value: Promise<Result>) { return value && value && value; }",
		"  fourth(value: Promise<Result>) { return value && value && value; }",
		"  template(first: T) { return first && first && first; }",
		"  template_again(first: T) { return first && first && first; }",
		"  template_third(first: T) { return first && first && first; }",
		"}",
	].join("\n"),
};

export const GENERIC_SIGNATURE_FILES = {
	"generic-signatures.ts": [
		"function accepts(value: unknown): string { return String(value); }",
		"function returns(value: string): unknown { return value; }",
		"function concrete(value: string): number { return value.length; }",
	].join("\n"),
	"generic-signatures.py": [
		"from typing import Any",
		"",
		"def accepts(value: Any) -> str:",
		"    return str(value)",
		"",
		"def returns(value: str) -> Any:",
		"    return value",
		"",
		"def concrete(value: str) -> int:",
		"    return len(value)",
	].join("\n"),
};

export const INTERFACE_PORT_FILES = {
	"source.ts":
		"interface EffectsPort { click(): void; }\nclass Effects implements EffectsPort {\n  click() {}\n}\nclass Waiter {\n  wait() {}\n}",
	"one.ts":
		"import { Effects, Waiter } from './source';\nfunction run(effects: EffectsPort, waiter = new Waiter()) {\n  effects.click();\n  waiter.wait();\n}\nrun(new Effects());",
};
