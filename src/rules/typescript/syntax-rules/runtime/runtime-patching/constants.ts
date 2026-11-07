export const PATCH_METHODS = new Map<string, ReadonlySet<string>>([
	["jest", new Set(["spyOn", "mock", "doMock", "unmock", "replaceProperty"])],
	["vi", new Set(["spyOn", "mock", "doMock", "unmock", "stubGlobal", "stubEnv"])],
	["sinon", new Set(["stub", "replace", "replaceGetter", "replaceSetter"])],
]);
export const OBJECT_PATCH_OWNER_NAME = "Object";
export const OBJECT_ASSIGN_METHOD_NAME = "assign";
export const OBJECT_DEFINE_PROPERTY_METHOD_NAME = "defineProperty";
export const REFLECT_PATCH_OWNER_NAME = "Reflect";
export const REFLECT_SET_METHOD_NAME = "set";
export const MOCK_FACTORY_FRAMEWORK_NAMES = new Set(["jest", "vi"]);
export const MOCK_FACTORY_METHOD_NAME = "fn";
export const PATCH_DESCRIPTOR_KEYS = new Set(["value", "get", "set"]);
export const PATCH_DESCRIPTOR_OWNERS = new Set(["Object", "Reflect"]);
export const EMPTY_PATCH_METHODS: ReadonlySet<string> = new Set<string>();
