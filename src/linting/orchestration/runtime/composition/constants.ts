import type { SharedCallableKind } from "src/metrics/types";

export const MAX_COMPOSITION_DEPTH = 3;
export const MAX_CONSTRUCTOR_DEPENDENCIES = 5;
export const PROPERTY_DECORATORS = new Set(["property", "cached_property"]);
export const CODING_LINT_PATH_PREFIX = "tools/coding-lint/";
export const CALLABLE_FUNCTION_KIND: SharedCallableKind = "function";
