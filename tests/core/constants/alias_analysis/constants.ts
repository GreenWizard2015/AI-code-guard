export const DYNAMIC_IMPORT_FILES = {
	"static.ts": "import { helper } from './helper';\nexport const value = helper();\n",
	"dynamic.ts": [
		"export async function loadFeature() {",
		"  return import('./feature');",
		"}",
		"const legacy = require('./legacy');",
	].join("\n"),
	"dynamic-type.ts": "type RelayRecord = import('../relay').RelayRecord;\n",
	"static.py": "from module import helper\nvalue = helper()\n",
	"nested.py": ["def load_feature():", "    from module import helper", "    return helper()"].join("\n"),
	"dynamic.py": [
		"import importlib",
		"import importlib as loader",
		"from importlib import import_module as load",
		"from builtins import __import__ as import_builtin",
		"import builtins as bi",
		"",
		"def load_module():",
		'    first = importlib.import_module("module")',
		'    second = __import__("legacy")',
		'    third = loader.import_module("alias")',
		'    fourth = load("direct")',
		'    fifth = import_builtin("builtin")',
		'    sixth = bi.__import__("qualified")',
		"    module_alias = importlib",
		'    seventh = module_alias.import_module("assigned-module")',
		"    module_loader = loader.import_module",
		'    eighth = module_loader("assigned-function")',
		"    builtin_loader = bi.__import__",
		'    ninth = builtin_loader("assigned-builtin")',
		"    destructured_loader, ignored = (load, None)",
		'    tenth = destructured_loader("assigned-destructured")',
		"    starred_loader, *ignored = (load, None, None)",
		'    eleventh = starred_loader("assigned-starred")',
		"    return first, second, third, fourth, fifth, sixth, seventh, eighth, ninth, tenth, eleventh",
	].join("\n"),
};

export const ALIAS_RULE_FILES = {
	"reexport.ts": "export { helper } from './helper';\n",
	"reexport.py": "from module import helper\nhelper_alias = helper\n",
	"alias.ts":
		"export function getCurrentPathname(): string {\n  const pathname = globalThis.location.pathname;\n  return pathname;\n}",
	"destructure.ts":
		"export function getCurrentLocationPathname(): string {\n  const { pathname } = globalThis.location;\n  return { pathname };\n}",
	"variable.ts": "export function getComputedValue(): string {\n  var value = readValue();\n  return value;\n}",
	"variable.py": "def get_computed_value():\n    value = read_value()\n    return value",
	"chain.ts":
		'export function describeMode(): string {\n  const mode = "passthrough";\n  const result = mode;\n  return result;\n}',
	"chain.py": 'def describe_mode():\n    mode = "passthrough"\n    result = mode\n    return result',
	"multiline-object.ts":
		"export function createOptions(): Options {\n  const options: Options = {\n    enabled: true,\n  };\n  return options;\n}",
	"constructor-factories.ts":
		"function createProxy(): Proxy {\n  const options = createOptions();\n  return new Proxy(options);\n}\nfunction createBridge(): Client {\n  const transport = createTransport();\n  const client = new Client(transport);\n  return client;\n}",
	"inline-types.ts":
		'type NamedShape = { value: string };\nfunction readShape(input: { value: string }): string {\n  return input.value;\n}\nfunction create_shell(): {\n  header: HTMLDivElement;\n  body: HTMLDivElement;\n  footer: HTMLDivElement;\n} {\n  return createShellValue();\n}\nfunction mutation_name(action: "send" | "confirm"): string {\n  return action;\n}',
};

export const ALIAS_TEST_FILES = {
	"tests/inline-types.test.ts":
		"function readShape(input: { camelCaseFieldWithExtraWords: string }): string {\n  return input.value;\n}",
	"tests/inline-type-fields.test.ts":
		"function readShape(input: { camelCaseFieldWithExtraWords: string }): string {\n  return input.camelCaseFieldWithExtraWords;\n}",
};

export const MIXED_DEPENDENCY_FILES = {
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

export const CONSTRUCTOR_FILES = {
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

export const STRUCTURAL_ALIAS_FILES = {
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

export const PYTHON_FRAMEWORK_HOOK_FILES = {
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
