export const EXPORT_USAGE_FILES = {
	typescript: {
		"source.ts": "export function public_function() { return 1; }\nexport class PublicService {\n  run() {}\n}",
	},
	python: {
		"source.py":
			'__all__ = ["public_function", "PublicService"]\n\ndef public_function():\n    return 1\n\nclass PublicService:\n    def run(self):\n        return 1',
	},
};

export const AWAITED_RETURN_FILES = {
	"source.ts":
		"export class DomElement {\n  raw() {}\n  text() {}\n}\nexport class OtherElement {\n  text() {}\n}\nexport function create_element(): Promise<DomElement | null> {\n  return Promise.resolve(null);\n}",
	"one.ts":
		"import { create_element, OtherElement } from './source';\nasync function use_elements() {\n  const element = await create_element();\n  element?.raw();\n  new OtherElement().text();\n}",
};

export const LOCAL_CALLABLE_FILES = {
	"source.ts":
		"class Service { helper() { return 1; } run() { return this.helper(); } private hidden() { return 2; } }",
};

export const LOCAL_PYTHON_CALLABLE_FILES = {
	"source.py":
		"class Service:\n    def helper(self):\n        return 1\n    def run(self):\n        return self.helper()\n    def _hidden(self):\n        return 2",
};

export const PROTOCOL_CONTAINER_FILES = {
	"source.py":
		"from typing import Protocol\n\nclass RequestHandler(Protocol):\n    def matches(self):\n        ...\n    def handle(self):\n        ...\n\nclass ConcreteHandler:\n    def matches(self):\n        return True\n    def handle(self):\n        return None",
	"dispatcher.py":
		"from source import ConcreteHandler, RequestHandler\n\nclass Dispatcher:\n    def __init__(self):\n        self.handlers: list[RequestHandler] = [ConcreteHandler()]\n\n    def run(self):\n        for handler in self.handlers:\n            if handler.matches():\n                handler.handle()",
};

export const TYPE_CHECKING_PROPERTY_FILES = {
	"source.py": "class BrowserBridgeDirectory:\n    def has_tool(self, name):\n        return True",
	"mixin.py":
		'from source import BrowserBridgeDirectory\n\n\nclass UpstreamMixin:\n    if TYPE_CHECKING:\n        @property\n        def browser_registry(self) -> BrowserBridgeDirectory:\n            ...\n\n    def resolve(self):\n        return self.browser_registry.has_tool("tool")',
};

export const FORWARD_ANNOTATION_FILES = {
	"transport.py": "class BrowserBridgeTransport:\n    def poll(self):\n        return None",
	"server.py":
		'from transport import BrowserBridgeTransport\nclass Server:\n    @property\n    def browser_bridge_transport(self) -> "BrowserBridgeTransport":\n        ...\n    def build_client(self) -> Client:\n        return Client()\n    def use_client(self):\n        client = self.build_client()\n        client.initialize()',
	"client.py": "class Client:\n    def initialize(self):\n        return None",
	"dispatcher.py":
		"from server import Server\nclass Dispatcher:\n    def run(self, server: Server):\n        server.browser_bridge_transport.poll()",
};

export const TYPESCRIPT_USAGE_FILES = {
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
	"two.ts": ["import { twice, Service } from './source';", "twice();", "new Service().twice();"].join("\n"),
	"tests/usage.ts": ["import { testOnly } from '../source';", "testOnly();"].join("\n"),
};

export const PYTHON_USAGE_FILES = {
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
	"two.py": ["from source import twice, Service", "twice()", "Service().twice()"].join("\n"),
	"tests/usage.py": ["from source import once", "once()"].join("\n"),
};

export const EXTERNAL_NAME_FILES = {
	"source.ts":
		"unsafeWindow;\nGM_xmlhttpRequest;\nMpsTypes;\nToolAnnotations;\nconst ProjectToolAnnotations = {};\nconst MockMpsTypes = globalThis.MpsTypes;\nconst InternalPayload = {};\nconst JsonObject = {};\nconst TaskRecord = {};\nconst ExternalWindow = globalThis.ExternalWindow;",
};

export const PYTHON_ALIAS_FILES = {
	"source.py":
		"from typing import TypeAlias\nvalid_alias: TypeAlias = str\n_PrivateAlias: TypeAlias = str\nValidAlias: TypeAlias = str\nTooManyAliasWordsHere: TypeAlias = str",
};

export const TYPESCRIPT_DECLARATION_FILES = {
	"source.ts":
		"type invalid_type = string;\ninterface _InvalidInterface {}\nenum invalid_enum { Value }\nclass _InvalidClass {}\ntype ValidType = string;\ninterface ValidInterface { value: string; }\nenum ValidEnum { Value }\nclass ValidClass {}",
};

export const IGNORED_EXTERNAL_NAMES = ["unsafeWindow", "MpsTypes", "ToolAnnotations"];

export const REPORTED_PROJECT_NAMES = [
	"MockMpsTypes",
	"InternalPayload",
	"JsonObject",
	"TaskRecord",
	"ExternalWindow",
	"ProjectToolAnnotations",
];

export const NULLABLE_DOMAIN_FILES = {
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
