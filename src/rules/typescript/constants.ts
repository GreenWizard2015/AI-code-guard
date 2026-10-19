import type { SourceFileResolver, TypeScriptNodeRulesContract } from "src/protocols";

export const GENERIC_TYPES = new Set([
	"Any",
	"any",
	"object",
	"Object",
	"unknown",
	"typing.Any",
	"typing_extensions.Any",
]);

export const NODE_RULES_BY_RESOLVER = new WeakMap<SourceFileResolver, TypeScriptNodeRulesContract>();
