import { dirname, resolve } from "node:path";

import { fileURLToPath } from "node:url";
import { LintProjectContextStore } from "src/bridge/ts/core/project-context";
import type { ProjectSourceOptions } from "src/bridge/ts/runner/types";

export const SOURCE_OPTIONS: ProjectSourceOptions = {
	context_state: {
		available: false,
		value: new LintProjectContextStore([], {
			source_reads: 0,
			typescript_parses: 0,
			python_parses: 0,
			source_records: 0,
		}),
	},
	entry_files: [],
};

export const PROJECT_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

export const grouped_protocol_files = {
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

export const composition_files = {
	"composition-root.ts":
		"import { CompositionMiddle } from './composition-middle';\nexport const CompositionRoot = class CompositionRoot {\n  private readonly middle = new CompositionMiddle();\n};",
	"composition-middle.ts":
		"import { CompositionLeaf } from './composition-leaf';\nexport const CompositionMiddle = class CompositionMiddle {\n  private readonly leaf = new CompositionLeaf();\n};",
	"composition-leaf.ts":
		"import { CompositionEnd } from './composition-end';\nexport const CompositionLeaf = class CompositionLeaf {\n  private readonly end = new CompositionEnd();\n};",
	"composition-end.ts": [
		"export const CompositionEnd = class CompositionEnd {",
		"  run() {",
		...Array.from(
			{ length: 14 },
			(_, index) => `    const value${index} = ${index};`,
		),
		"  }",
		"};",
	].join("\n"),
};

export const singleton_files = {
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
	"imported-singleton.ts":
		"import { ImportedService } from './service';\nconst imported = new ImportedService();",
	"service.ts": "export class ImportedService {}",
	"singleton.py": [
		"class Service:",
		"    pass",
		"service = Service()",
		"def build():",
		"    return Service()",
	].join("\n"),
};

export const callable_limit_files = {
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
		...Array.from(
			{ length: 16 },
			(_, index) => `export function grouped${index}() { return ${index}; }`,
		),
		"export function _Agent_load() { return 1; }",
		"export function _Agent_save() { return 1; }",
	].join("\n"),
	"metrics.py": [
		"def too_many(a, b, c, d, e, f):",
		"    return a + b + c + d + e + f",
		...Array.from(
			{ length: 16 },
			(_, index) => `def grouped_${index}(): return ${index}`,
		),
		"def _Worker_start(): return 1",
		"def _Worker_stop(): return 1",
	].join("\n"),
	"imports.py": [
		"from module import (",
		"    _Dispatcher_send,",
		"    _Dispatcher_receive,",
		")",
		"value = 1",
	].join("\n"),
};
export const short_class_files = {
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

export const shared_threshold_files = {
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

export const separate_class_files = {
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

export const method_candidates_files = {
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

export const project_wide_parameter_files = {
	"first.ts":
		"class RequestData {}\nfunction load(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
	"second.ts": [
		"function save(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
		"function update(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
		"function remove(request: RequestData, cache: CacheData) { return request && cache && request && cache; }",
	].join("\n"),
};

export const type_operation_files = {
	"type-operations.ts": [
		'type Selected = Pick<RecordData, "id">;',
		'type Field = RecordData["id"];',
		"type Combined = RecordData & { value: string };",
		"type JsonMap = Record<string, unknown>;",
		"function read(input: Selected) { return input; }",
	].join("\n"),
	"tests/type-operations.ts": 'type Selected = Pick<RecordData, "id">;',
};

export const external_type_files = {
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

export const generic_signature_files = {
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

export const interface_port_files = {
	"source.ts":
		"interface EffectsPort { click(): void; }\nclass Effects implements EffectsPort {\n  click() {}\n}\nclass Waiter {\n  wait() {}\n}",
	"one.ts":
		"import { Effects, Waiter } from './source';\nfunction run(effects: EffectsPort, waiter = new Waiter()) {\n  effects.click();\n  waiter.wait();\n}\nrun(new Effects());",
};
export const export_usage_files = {
	typescript: {
		"source.ts":
			"export function public_function() { return 1; }\nexport class PublicService {\n  run() {}\n}",
	},
	python: {
		"source.py":
			'__all__ = ["public_function", "PublicService"]\n\ndef public_function():\n    return 1\n\nclass PublicService:\n    def run(self):\n        return 1',
	},
};
export const awaited_return_files = {
	"source.ts":
		"export class DomElement {\n  raw() {}\n  text() {}\n}\nexport class OtherElement {\n  text() {}\n}\nexport function create_element(): Promise<DomElement | null> {\n  return Promise.resolve(null);\n}",
	"one.ts":
		"import { create_element, OtherElement } from './source';\nasync function use_elements() {\n  const element = await create_element();\n  element?.raw();\n  new OtherElement().text();\n}",
};

export const local_callable_files = {
	"source.ts":
		"class Service { helper() { return 1; } run() { return this.helper(); } private hidden() { return 2; } }",
};
export const local_python_callable_files = {
	"source.py":
		"class Service:\n    def helper(self):\n        return 1\n    def run(self):\n        return self.helper()\n    def _hidden(self):\n        return 2",
};
export const protocol_container_files = {
	"source.py":
		"from typing import Protocol\n\nclass RequestHandler(Protocol):\n    def matches(self):\n        ...\n    def handle(self):\n        ...\n\nclass ConcreteHandler:\n    def matches(self):\n        return True\n    def handle(self):\n        return None",
	"dispatcher.py":
		"from source import ConcreteHandler, RequestHandler\n\nclass Dispatcher:\n    def __init__(self):\n        self.handlers: list[RequestHandler] = [ConcreteHandler()]\n\n    def run(self):\n        for handler in self.handlers:\n            if handler.matches():\n                handler.handle()",
};
export const type_checking_property_files = {
	"source.py":
		"class BrowserBridgeDirectory:\n    def has_tool(self, name):\n        return True",
	"mixin.py":
		'from source import BrowserBridgeDirectory\n\n\nclass UpstreamMixin:\n    if TYPE_CHECKING:\n        @property\n        def browser_registry(self) -> BrowserBridgeDirectory:\n            ...\n\n    def resolve(self):\n        return self.browser_registry.has_tool("tool")',
};
export const forward_annotation_files = {
	"transport.py":
		"class BrowserBridgeTransport:\n    def poll(self):\n        return None",
	"server.py":
		'from transport import BrowserBridgeTransport\nclass Server:\n    @property\n    def browser_bridge_transport(self) -> "BrowserBridgeTransport":\n        ...\n    def build_client(self) -> Client:\n        return Client()\n    def use_client(self):\n        client = self.build_client()\n        client.initialize()',
	"client.py": "class Client:\n    def initialize(self):\n        return None",
	"dispatcher.py":
		"from server import Server\nclass Dispatcher:\n    def run(self, server: Server):\n        server.browser_bridge_transport.poll()",
};

export const typescript_usage_files = {
	"source.ts": [
		"function once() { return 1; }",
		"function twice() { return 2; }",
		"function testOnly() { return 3; }",
		"function _privateFunction() { return 4; }",
		"class Service {",
		"  once() { return 1; }",
		"  twice() { return 2; }",
		"  private privateOnce() { return 3; }",
		"}",
	].join("\n"),
	"one.ts": [
		"import { once as onceAlias, twice, Service } from './source';",
		"onceAlias();",
		"twice();",
		"new Service().once();",
		"new Service().twice();",
	].join("\n"),
	"two.ts": [
		"import { twice, Service } from './source';",
		"twice();",
		"new Service().twice();",
	].join("\n"),
	"tests/usage.ts": [
		"import { testOnly } from '../source';",
		"testOnly();",
	].join("\n"),
};
export const python_usage_files = {
	"source.py": [
		"def once():",
		"    return 1",
		"",
		"def twice():",
		"    return 2",
		"",
		"def local_only():",
		"    return 1",
		"",
		"def caller():",
		"    return local_only()",
		"",
		"def _private_function():",
		"    return 3",
		"",
		"class Service:",
		"    def once(self):",
		"        return 1",
		"    def twice(self):",
		"        return 2",
		"    def _private_method(self):",
		"        return 3",
	].join("\n"),
	"one.py": [
		"from source import once as once_alias, twice, Service",
		"once_alias()",
		"twice()",
		"Service().once()",
		"Service().twice()",
	].join("\n"),
	"two.py": [
		"from source import twice, Service",
		"twice()",
		"Service().twice()",
	].join("\n"),
	"tests/usage.py": ["from source import once", "once()"].join("\n"),
};

export const external_name_files = {
	"source.ts":
		"const unsafeWindow = globalThis.window;\nconst MpsTypes = globalThis.MpsTypes;\nconst ToolAnnotations = {};\nconst ProjectToolAnnotations = {};\nconst MockMpsTypes = globalThis.MpsTypes;\nconst InternalPayload = {};\nconst JsonObject = {};\nconst TaskRecord = {};\nconst ExternalWindow = globalThis.ExternalWindow;",
};
export const python_alias_files = {
	"source.py":
		"from typing import TypeAlias\nvalid_alias: TypeAlias = str\n_PrivateAlias: TypeAlias = str\nValidAlias: TypeAlias = str\nTooManyAliasWordsHere: TypeAlias = str",
};
export const typescript_declaration_files = {
	"source.ts":
		"type invalid_type = string;\ninterface _InvalidInterface {}\nenum invalid_enum { Value }\nclass _InvalidClass {}\ntype ValidType = string;\ninterface ValidInterface { value: string; }\nenum ValidEnum { Value }\nclass ValidClass {}",
};
export const ignored_external_names = [
	"unsafeWindow",
	"MpsTypes",
	"ToolAnnotations",
];
export const reported_project_names = [
	"MockMpsTypes",
	"InternalPayload",
	"JsonObject",
	"TaskRecord",
	"ExternalWindow",
	"ProjectToolAnnotations",
];

export const nullable_domain_files = {
	"nullable.py": [
		"import typing",
		"from typing import Optional, Union",
		"class User:",
		"    pass",
		"class UserStore:",
		"    user: Optional[User]",
		"    other: typing.Union[User, None]",
		"    legacy: User | None",
		"    label: Optional[str]",
		"",
		"def find_user(user_id: str) -> Optional[User]:",
		"    return None",
	].join("\n"),
	"nullable.ts": [
		"class User {}",
		"class UserStore {",
		"\tpublic user: User | null;",
		"\tpublic label: string | null;",
		"\tpublic optional_label?: string;",
		"\tpublic find_user(id: string): User | undefined { return undefined; }",
		"}",
		"const label: string | null = null;",
	].join("\n"),
};

export const documentation_readme = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../docs/rules/README.md",
);

export const report_sections = [
	"[info]",
	"[warning]",
	"Reference docs:",
	"Solutions, from most to least invasive:",
	"1. Try refactoring all callers",
	"Attempt every level in order; do not skip directly to the smallest change.",
	"Do not revert a change just because it reveals additional problems",
	"Design refactors carefully so classes remain immutable whenever possible",
	"If a problem cannot be fixed locally, analyze it from the perspective of the calling code.",
];

export const report_count_violations = [
	{
		file: "b.ts",
		line: 1,
		message: "one",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
	{
		file: "a.ts",
		line: 1,
		message: "one",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
	{
		file: "a.ts",
		line: 2,
		message: "two",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
];

export const report_sorted_violations = [
	...Array.from({ length: 4 }, (_, line) => ({
		file: "a.ts",
		line: line + 1,
		message: "a",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	})),
	...Array.from({ length: 3 }, (_, line) => ({
		file: "b.ts",
		line: line + 1,
		message: "b",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	})),
	...Array.from({ length: 2 }, (_, line) => ({
		file: "c.ts",
		line: line + 1,
		message: "c",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	})),
	{
		file: "d.ts",
		line: 1,
		message: "d",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
];

export const critical_only_violations = [
	{
		file: "worker.ts",
		line: 1,
		message:
			"module-level functions must be declared in the project-root functions file",
		hint: "FIRST move all functions to {project root}/functions.{ext}, then fix other problems.",
		rule_id: "function-placement",
		priority: 3 as const,
	},
	{
		file: "worker.ts",
		line: 2,
		message: "another problem",
		hint: "fix",
		rule_id: "parse-error",
		priority: 2 as const,
	},
];

export const dynamic_import_files = {
	"static.ts":
		"import { helper } from './helper';\nexport const value = helper();\n",
	"dynamic.ts": [
		"export async function loadFeature() {",
		"  return import('./feature');",
		"}",
		"const legacy = require('./legacy');",
	].join("\n"),
	"dynamic-type.ts": "type RelayRecord = import('../relay').RelayRecord;\n",
	"static.py": "from module import helper\nvalue = helper()\n",
	"nested.py": [
		"def load_feature():",
		"    from module import helper",
		"    return helper()",
	].join("\n"),
	"dynamic.py": [
		"import importlib",
		"",
		"def load_module():",
		'    first = importlib.import_module("module")',
		'    second = __import__("legacy")',
		"    return first, second",
	].join("\n"),
};
export const alias_rule_files = {
	"reexport.ts": "export { helper } from './helper';\n",
	"reexport.py": "from module import helper\nhelper_alias = helper\n",
	"alias.ts":
		"export function getCurrentPathname(): string {\n  const pathname = globalThis.location.pathname;\n  return pathname;\n}",
	"destructure.ts":
		"export function getCurrentLocationPathname(): string {\n  const { pathname } = globalThis.location;\n  return { pathname };\n}",
	"variable.ts":
		"export function getComputedValue(): string {\n  var value = readValue();\n  return value;\n}",
	"variable.py":
		"def get_computed_value():\n    value = read_value()\n    return value",
	"chain.ts":
		'export function describeMode(): string {\n  const mode = "passthrough";\n  const result = mode;\n  return result;\n}',
	"chain.py":
		'def describe_mode():\n    mode = "passthrough"\n    result = mode\n    return result',
	"multiline-object.ts":
		"export function createOptions(): Options {\n  const options: Options = {\n    enabled: true,\n  };\n  return options;\n}",
	"constructor-factories.ts":
		"function createProxy(): Proxy {\n  const options = createOptions();\n  return new Proxy(options);\n}\nfunction createBridge(): Client {\n  const transport = createTransport();\n  const client = new Client(transport);\n  return client;\n}",
	"inline-types.ts":
		'type NamedShape = { value: string };\nfunction readShape(input: { value: string }): string {\n  return input.value;\n}\nfunction create_shell(): {\n  header: HTMLDivElement;\n  body: HTMLDivElement;\n  footer: HTMLDivElement;\n} {\n  return createShellValue();\n}\nfunction mutation_name(action: "send" | "confirm"): string {\n  return action;\n}',
};
export const alias_test_files = {
	"tests/inline-types.test.ts":
		"function readShape(input: { camelCaseFieldWithExtraWords: string }): string {\n  return input.value;\n}",
	"tests/inline-type-fields.test.ts":
		"function readShape(input: { camelCaseFieldWithExtraWords: string }): string {\n  return input.camelCaseFieldWithExtraWords;\n}",
};

export const mixed_dependency_files = {
	"navigation-dependencies.ts": [
		"type ChatGptNewChatButtonFinder = () => HTMLAnchorElement;",
		"type ChatGptNewChatNavigationWaiter = () => Promise<void>;",
		"export interface ChatGptNewChatOpener { open_if_needed(): Promise<void>; }",
		"type NewChatOpenerDependencies = {",
		"  button_finder: ChatGptNewChatButtonFinder;",
		"  navigation_waiter: ChatGptNewChatNavigationWaiter;",
		"  conversation_state: ChatGptConversationStatePort;",
		"};",
	].join("\n"),
	"padding-a.ts": "export const paddingA = 1;",
	"padding-b.ts": "export const paddingB = 2;",
};
export const constructor_files = {
	"constructors.ts": [
		"class Invalid {",
		"  constructor() { this.document = this.create_document(); }",
		"  create_document() { return {}; }",
		"}",
		"class Valid {",
		"  private readonly dependency = new Dependency();",
		"  constructor(value: string, options: Map<string, string>) {",
		"    if (!value) {",
		'      throw new Error("value required");',
		"    }",
		'    this.value = options.get("value") ?? value;',
		"  }",
		"}",
	].join("\n"),
	"constructors.py": [
		"class Invalid:",
		"    def __post_init__(self):",
		"        self.document = self._create_document()",
		"    def _create_document(self):",
		"        return {}",
		"class Valid:",
		"    def __init__(self, value, options):",
		"        if not value:",
		'            raise ValueError("value required")',
		'        self.value = options.get("value", value)',
	].join("\n"),
};
export const structural_alias_files = {
	"source.ts": [
		"export class Dependency {",
		"  run() { return 1; }",
		"}",
		"export type Runtime = { dependency: Dependency };",
		"export class Consumer {",
		"  constructor(private readonly dependency: Dependency) {}",
		"  execute() { this.dependency.run(); }",
		"}",
		"export class Panel {",
		"  constructor(private readonly runtime: Runtime) {}",
		"  execute() { this.runtime.dependency.run(); }",
		"}",
	].join("\n"),
	"one.ts": [
		"import { Consumer, Dependency, Panel, type Runtime } from './source';",
		"const dependency = new Dependency();",
		"const consumer = new Consumer(dependency);",
		"const runtime: Runtime = { dependency };",
		"const panel = new Panel(runtime);",
		"consumer.execute();",
		"panel.execute();",
	].join("\n"),
	"two.ts": [
		"import { Consumer, Dependency, Panel, type Runtime } from './source';",
		"const dependency = new Dependency();",
		"const consumer = new Consumer(dependency);",
		"const runtime: Runtime = { dependency };",
		"const panel = new Panel(runtime);",
		"consumer.execute();",
		"panel.execute();",
	].join("\n"),
};
export const python_framework_hook_files = {
	"source.py": [
		"class Handler:",
		"    @property",
		"    def value(self):",
		"        return 1",
		"",
		"    @cached_property",
		"    def cached(self):",
		"        return 2",
		"",
		"    def do_GET(self):",
		"        return None",
		"",
		"    def log_message(self, format, *args):",
		"        return None",
	].join("\n"),
};
export const specialization_source = [
	"class Tiny { run() {} }",
	`class Broad {\n${Array.from({ length: 6 }, (_, index) => `  public${index}() {}`).join("\n")}\n}`,
	`class Huge {\n${Array.from({ length: 16 }, (_, index) => `  method${index}() {}`).join("\n")}\n}`,
	"class Implementation {",
	"  public run() {}",
	"  private first() {}",
	"}",
	"interface Contract { first(): void; second(): void; }",
	`class Adapter implements Contract {\n${Array.from({ length: 6 }, (_, index) => `  method${index}() {}`).join("\n")}\n}`,
].join("\n");
export const python_callable_source = [
	"class Service:",
	"    def __init__(self, value: str) -> None:",
	"        self.value = value",
	"",
	"    async def run(self, first: str, *, second: int = 0) -> str:",
	"        return first + first + first + first",
	"",
	"def build(name: str, count: int = 1) -> str:",
	'    return f"{name}:{count}"',
	"",
	"async def load(*items: str, **options: object) -> list[str]:",
	"    return list(items)",
].join("\n");
export const control_flow_source = [
	"def conditional(value: bool) -> None:",
	"    if value:",
	"        execute()",
	"",
	"def repeated(values: list[str]) -> None:",
	"    for value in values:",
	"        execute(value)",
	"",
	"def guarded(value: bool) -> None:",
	"    while value:",
	"        execute()",
	"",
	"def protected_call() -> None:",
	"    with resource():",
	"        execute()",
	"",
	"def selected(value: str) -> None:",
	"    match value:",
	'        case "a":',
	"            execute()",
	"",
	"def conditional_fallback(value: bool) -> None:",
	"    if value:",
	"        execute()",
	"    else:",
	"        fallback()",
	"",
	"def recovered() -> None:",
	"    try:",
	"        execute()",
	"    except RuntimeError:",
	"        recover()",
].join("\n");
export const python_composition_files = {
	"root.py": [
		"from .middle import Middle",
		"",
		"class Root:",
		"    def __init__(self):",
		"        self.middle = Middle()",
	].join("\n"),
	"middle.py": [
		"from .leaf import Leaf",
		"",
		"class Middle:",
		"    def __init__(self):",
		"        self.leaf = Leaf()",
	].join("\n"),
	"leaf.py": [
		"from .end import End",
		"",
		"class Leaf:",
		"    def __init__(self):",
		"        self.end = End()",
	].join("\n"),
	"end.py": ["class End:", "    pass"].join("\n"),
};
export const forbidden_syntax_probe_files = {
	"sample.ts": [
		"export class Sample {",
		"  static helper() { return 1; }",
		"  method(a: string, b: string, c: string, d: string, e: string, f: string) {",
		"    return a + b + c + d + e + f;",
		"  }",
		"}",
		"Sample.prototype.legacy = function legacy() { return 1; };",
		"export function check(value: unknown) {",
		"  return Object.prototype.toString.call(value);",
		"  const formatted = new Formatter(config).format(value);",
		"  const retried = new Formatter(first, second, third).retry(value);",
		"}",
		'const cached = getattr(obj, "value");',
		'setattr(obj, "value", cached);',
		"const result = structuredContent;",
		"unwrap_tool_result(result);",
		"} catch {",
		"  console.error(error);",
		"}",
	].join("\n"),
	"sample.py": [
		"try:",
		"    pass",
		"except:",
		"    pass",
		"try:",
		"    pass",
		"except (ValueError, TypeError) as error:",
		"    pass",
		"@staticmethod",
		"@classmethod",
		"def too_many(a, b, c, d, e, f):",
		"    return a + b + c + d + e + f",
		"value = isinstance(item, str)",
		"if not callable(handler):",
		"    value = Formatter(config).format(input)",
		"    retried = Formatter(first, second, third).retry(input)",
		"    pass",
		"class_node = PythonClassNode(tree.body[1], CLASS_SOURCE).result",
	].join("\n"),
	"dynamic.py": [
		"DynamicServer = type(",
		'    "DynamicServer",',
		"    (ThreadingHTTPServer,),",
		'    {"daemon_threads": True},',
		")",
	].join("\n"),
};
export const conditional_block_files = {
	"conditional-blocks.ts": [
		"if (ready) submit();",
		"if (ready) { submit(); } else recover();",
		"if (ready) { submit(); } else if (retry) { recover(); }",
		"if (ready) { submit(); } else { recover(); }",
	].join("\n"),
	"conditional-blocks.py": [
		"if ready:",
		"    submit()",
		"elif retry:",
		"    recover()",
		"else:",
		"    finish()",
	].join("\n"),
	"nested-conditional.py": [
		"if ready:",
		"    submit()",
		"else:",
		"    if retry:",
		"        recover()",
	].join("\n"),
};
export const forwarding_files = {
	"proxy.ts": [
		"class Service {",
		"  constructor(private readonly dependency: Dependency) {}",
		"  get_context() {",
		"    return this.dependency;",
		"  }",
		"  update_title(id: string, title: string) {",
		"    return this.dependency.update_title(id, title);",
		"  }",
		"  notify(id: string) {",
		"    this.dependency.notify(id);",
		"  }",
		"  close_contact_reason() {",
		"    return this.required_reason();",
		"  }",
		"}",
		"function delay(milliseconds: number) {",
		"  return wait_polling_duration(milliseconds);",
		"}",
		"function typed_validation_error(message: string, details: JsonObject = {}) {",
		"  return new FacebookAiAgentValidationError(message, details);",
		"}",
		"function build_proxy_config(args: Config) {",
		"  return load_proxy_config(args.config);",
		"}",
		"function reordered_validation_error(message: string, details: JsonObject = {}) {",
		"  return new FacebookAiAgentValidationError(details, message);",
		"}",
	].join("\n"),
	"proxy.py": [
		"class Executor:",
		"    def handle_rpc(self, payload, unwrap_tool_response=False):",
		"        self._handle_rpc(payload, unwrap_tool_response)",
		"",
		"    def handle_tool_call(self, payload, unwrap_tool_response=True):",
		"        self._handle_tool_call(unwrap_tool_response, payload)",
		"",
		"def delay(milliseconds):",
		"    return wait_polling_duration(milliseconds)",
		"",
		"def build_proxy_config(args):",
		"    return load_proxy_config(args.config)",
	].join("\n"),
};
export const typeof_cases = {
	single:
		'function read(value: unknown): string {\n  if (typeof value === "string") {\n    return value;\n  }\n  return "";\n}',
	repeated:
		'function read(value: unknown): string {\n  if (typeof value === "string") {\n    return value;\n  }\n  if (typeof value === "number") {\n    return String(value);\n  }\n  return "";\n}',
};
export const protocol_reference_files: Record<string, string> = {
	"ports.ts": "export interface ServicePort { run(): void; }",
	"protocols.py":
		"from typing import Protocol\n\nclass ServicePort(Protocol):\n    def run(self) -> None: ...",
};
export const contract_field_files = {
	"contract-fields.ts": [
		"interface UserStore {",
		"  cache: Map<string, string>;",
		"  get(id: string): string;",
		"}",
	].join("\n"),
	"contract-fields.py": [
		"from typing import Protocol",
		"",
		"class UserStore(Protocol):",
		"    cache: dict[str, str]",
		"    enabled = True",
		"    def get(self, user_id: str) -> str: ...",
		"",
		"class DataShape:",
		"    value: str",
	].join("\n"),
};
export const type_node_source =
	"type Result = (First);\ntype Union = First | Second;\ntype Factory = (value: string) => Result;\ntype Collection = Array<Result>;";
export const ast_source = [
	"export class Service {",
	"  constructor(private readonly value: string) {}",
	"  run(first: string, second: number): void {",
	"    console.log(first, first, first, first, second);",
	"  }",
	"}",
	"",
	"export const Worker = class {",
	"  execute(): void {",
	'    console.log("done");',
	"  }",
	"};",
	"",
	"export function build(",
	"  name: string,",
	"  count: number",
	"): string {",
	"  return " +
		String.fromCharCode(96) +
		"$" +
		"{name}:$" +
		"{count}" +
		String.fromCharCode(96) +
		";",
	"}",
	"",
	"export const convert = (value: string): string => {",
	"  return value.trim();",
	"};",
].join("\n");
export const short_function_node = {
	name: "shortFunction",
	start: 4,
	end: 5,
	argument_count: 0,
	characters: 100,
	lines: 2,
	sloc: 2,
	exception_only: false,
	visibility: "public" as const,
};
export const argument_function_node = {
	name: "argumentFunction",
	start: 4,
	end: 5,
	argument_count: 6,
	characters: 0,
	lines: 2,
	sloc: 2,
	exception_only: false,
	visibility: "public" as const,
};
export const short_method_class = {
	name: "Service",
	start: 0,
	end: 40,
	methods: [
		{
			name: "shortMethod",
			start: 4,
			end: 5,
			argument_count: 0,
			characters: 100,
			visibility: "public" as const,
		},
	],
	fields: [],
};
export const deterministic_function_files = {
	"b.ts": [
		"function third(value: SharedInput) { return value; }",
		"function fourth(value: SharedInput) { return value; }",
	].join("\n"),
	"a.ts": [
		"class SharedInput {}",
		"function first(value: SharedInput) { return value; }",
		"function second(value: SharedInput) { return value; }",
	].join("\n"),
};
export const arbitrary_combination_files = {
	"combinations.ts": [
		"class ProjectA {}",
		"class ProjectB {}",
		...Array.from(
			{ length: 4 },
			(_, index) =>
				"function run" +
				index +
				"(a: ProjectA, id: string, b: ProjectB, scope: string) { return [a, id, b, scope]; }",
		),
	].join("\n"),
};

export const coverage_control_flow_source = [
	"from typing import Any, Optional, Union",
	"",
	"class Parsed:",
	"    value: str | None",
	"    optional: Optional[str]",
	"    union: Union[str, None]",
	"    composite: Union[str, int]",
	"    single_union: Union[str]",
	"    optional_none: Optional[None]",
	"    nullish: None",
	"    broad: Any",
	"",
	"def check(parsed: Parsed, value: str):",
	"    result = value and fallback() or other()",
	"    ternary = value if value else fallback()",
	'    primitive: str = value if value else ""',
	"    constant = True if value else False",
	"    empty_list = []",
	"    empty_dict = {}",
	"    negative = -1",
	"    lambda_value = lambda item: item and value",
	"    if value:",
	"        result = value",
	"    elif parsed.value:",
	"        result = parsed.value",
	"    return result",
	"",
	"def simple(value: str):",
	"    if value:",
	"        return value",
	"",
	"def defaults(value: str, fallback: object = Factory(), primitive: int = -1):",
	"    return value if value else fallback",
	"    signed = -value",
	"    multiline = (value and",
	"        fallback() and",
	"        other())",
	"    constant_bool = True and False",
	"    standalone = value and fallback()",
	"",
	"def undefined_check(parsed: Parsed) -> bool:",
	"    return parsed.composite is None",
	"",
	"def walrus(value: str):",
	"    if (item := value):",
	"        return item",
	"    return None",
	"",
	"def compare(parsed: Parsed, value: str):",
	"    return parsed.value == None, parsed.value is value",
].join("\n");

export const access_source = [
	"from models import Model as Alias",
	"class Handler:",
	"    value: Alias",
	"    @property",
	"    def current(self) -> Alias:",
	"        return self.value",
	"    def make(self) -> Alias:",
	"        return Alias()",
	"",
	"class Service:",
	"    _value: str",
	"    __magic__: str",
	"    model: Alias",
	"    handler: Handler",
	"",
	"    @property",
	"    def value(self):",
	"        return self._value",
	"",
	"    @cached_property()",
	"    async def cached(self):",
	"        return self._value",
	"",
	"    def forward(self, value):",
	"        return worker(value)",
	"",
	"    async def await_forward(self, value):",
	"        return await worker(value)",
	"",
	"    def attribute_forward(self, value):",
	"        return handler.run(value)",
	"",
	"    def invalid_forward(self, value, *items, **options):",
	"        return handler.run(value.attr)",
	"",
	"    def private(self):",
	'        return getattr(external, "_value")',
	"",
	"    def private_set(self, value):",
	'        setattr(external, "_value", value)',
	'        return external.__getattribute__("_value")',
	"",
	"    def private_mapping(self, value):",
	'        external.__dict__["_value"] = value',
	'        return self.__dict__["_value"]',
	"        external.__dict__[value] = value",
	"",
	"    def private_names(self, value):",
	"        return external.__getattribute__(value)",
	"",
	"    def references(self, model: Alias):",
	"        self.model = model",
	"        self.handler = Handler()",
	"        first = self.model",
	"        second = self.handler.value",
	"        third = self.handler.current",
	"        created = self.handler.make()",
	"        return first, second, third, created",
	"",
	"    def invalid_private(self, value):",
	"        self._target._value = value",
	"        other._value = value",
	"        self.__magic__ = value",
	"        getattr(external)",
	"        getattr(external, value)",
	'        getattr(self, "_value")',
	'        getattr(external, "missing")',
	"        external.__dict__[value] = value",
	'        external.value["_value"] = value',
	'        make_external().__dict__["_value"] = value',
	"",
	"    def lambda_proxy(self):",
	"        return lambda value: self.forward(value)",
	"",
	"    def proxy_with_attribute(self, value):",
	"        return self.handler.forward(value)",
	"",
	"    def proxy_with_keyword_only(self, value, *, flag=False):",
	"        return worker(value)",
	"",
	"    def proxy_with_varargs(self, value, *items):",
	"        return worker(value)",
	"",
	"    def proxy_with_expression(self, value):",
	"        return worker(value + value)",
].join("\n");

export const structure_source = [
	"from dataclasses import dataclass",
	"from typing import Protocol",
	"",
	"@dataclass()",
	"class Data:",
	"    value: str",
	"",
	"@dataclass",
	"class AttributeData:",
	"    value: str",
	"",
	"class Contract(Protocol):",
	"    value: str",
	"",
	"class AttributeContract(foo.Protocol):",
	"    value: str",
	"",
	"class Empty:",
	"    pass",
	"",
	"class EmptyContract:",
	"    pass",
	"",
	"class Service(Data):",
	"    def __init__(self, value):",
	"        super().__init__()",
	"        self.value = make_value(value)",
	"        self.other = self.build()",
	"        validate_value(value)",
	"        value",
	"        self.extra = (lambda: value)()",
	"        self.typed: str",
	"        for item in value:",
	"            self.ready = item",
	"        self.untyped = value + 1",
	"        self.none_value: str",
	"",
	"    def build(self):",
	"        return value",
	"",
	"def precedence(value, other, third):",
	"    boolean = value and other or third",
	"    arithmetic = value + other * third",
	"    inverted = not value and other or third",
	"    arithmetic_group = (value + other) * third",
	"    not_only = not value",
	"    not value and other",
	"    return boolean, arithmetic",
	"",
	"def empty_values() -> list[str]:",
	"    pass",
	"",
	"def one_values() -> list[str]:",
	"    return []",
	"",
	"def many_values() -> list[str]:",
	"    if value:",
	"        return [value, other]",
	"    return [third]",
	"",
	"def nested_values() -> list[str]:",
	"    def inner() -> list[str]:",
	"        return []",
	"    callback = lambda: []",
	"    return []",
	"",
	"def untyped_values():",
	"    return []",
	"def scalar_value() -> str:",
	'    return "value"',
	"",
	"result = one_values()[0]",
	"method_result = factory.make()[0]",
	"dynamic_result = (factory())()[0]",
].join("\n");
