export const TYPE_SEPARATORS = "<>[](), |&?.:";
export const MAX_CAMEL_WORDS = 6;
export const METRIC_RULE_IDS = {
	attribute_depth: "attribute-depth",
	class_max_size: "class-max-size",
	class_min_size: "class-min-size",
	class_size: "class-size",
	callable_min_size: "callable-min-size",
	callable_max_size: "callable-max-size",
	argument_count: "argument-count",
} as const;
export const METRIC_KIND_CLASS_SIZE = "class_size";
export const METRIC_KIND_SHORT_CLASS = "short_class";
export const METRIC_KIND_CLASS_METHODS = "class_methods";
export const METRIC_KIND_SHORT_FUNCTION = "short_function";
export const METRIC_KIND_SHORT_METHOD = "short_method";
export const METRIC_KIND_LONG_FUNCTION = "long_function";
export const METRIC_KIND_LONG_METHOD = "long_method";
export const METRIC_KIND_METHOD = "method";
export const METRIC_KIND_FUNCTION = "function";
export const CONSTRUCTOR_NAME = "constructor";
export const PYTHON_CONSTRUCTOR_NAME = "__init__";
export const CONTRACT_SUFFIX = "Contract";
export const RESOLVER_SUFFIX = "Resolver";
export const PLUGIN_MARKER_TOKEN = "marker";
export const PLUGIN_MARKER_NAME = "pluginmarker";
export const READONLY_BUILTIN_TYPES: ReadonlySet<string> = new Set(["ReadonlyArray", "ReadonlyMap", "ReadonlySet"]);
export const UNDEFINED_TYPE_NAME = "undefined";
export const NAMESPACE_PARAMETER_CATEGORY = "namespace";
export const SHARED_PARAMETER_REFERENCE_KIND = "reference";
export const TYPESCRIPT_ARRAY_TYPE_NAME = "Array";
