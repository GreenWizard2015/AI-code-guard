import type { AstArgumentUse, AstCallableNode, AstCallableReference, AstClassNode, AstReferenceAlias, AstTypedArgument, AstVisibility, CallableOwnershipResolver, NormalizedAstFile } from 'src/types';
import type { CallableReferenceIndex } from 'src/metrics/callable-reference-index';
export type ParsedFile = { file: string; ast: NormalizedAstFile };
export type CallableDefinition = {
	file: string;
	kind: SharedCallableKind;
	node: AstCallableNode;
};

export type CallableProjectIndex = Map<string, Record<string, string>>;
export type CallableClassIndex = Map<string, AstClassNode>;
export type CallableMetricNode = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
	lines: number;
	sloc: number;
	characters: number;
	exception_only: boolean;
	visibility: AstVisibility;
};
export type SharedParameterNodeInput = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
	owner: string;
	has_self: boolean;
	argument_uses: AstArgumentUse[];
	typed_arguments: AstTypedArgument[];
	visibility: AstVisibility;
};
export type CallableDefinitionUsageOptions = {
	definition: CallableDefinition;
	parsed_files: ParsedFile[];
	production_files: ParsedFile[];
	definitions: CallableDefinition[];
	type_members: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	reference_index: CallableReferenceIndex;
	method_count: number;
};

export type CallableMatcherContext = {
	definition: CallableDefinition;
	parsed_files: ParsedFile[];
	definitions: CallableDefinition[];
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	reference_index: CallableReferenceIndex;
	ownership: CallableOwnershipResolver;
};

export type CallableMatcherReferenceContext = {
	definition: CallableDefinition;
	parsed_files: ParsedFile[];
	definitions: CallableDefinition[];
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	ownership: CallableOwnershipResolver;
	reference: AstCallableReference;
};

export type SharedCallableKind = 'function' | 'method';
export type SharedParameterKind = 'basic' | 'reference';
export type ParameterKindResult = { supported: boolean; value: SharedParameterKind };
export type SharedParameterLanguage = 'python' | 'typescript' | 'unknown';

export type CallableLocation = {
	readonly file: string;
	readonly line: number;
	readonly method: string;
};

export type AnalyzedParameter = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly project_type: boolean;
	readonly uses: number;
};

export type AnalyzedCallable = {
	readonly kind: SharedCallableKind;
	readonly language: SharedParameterLanguage;
	readonly location: CallableLocation;
	readonly parameters: readonly AnalyzedParameter[];
};

export type SharedParameterNode = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly project_type: boolean;
	readonly locations: readonly CallableLocation[];
};

export type SharedParameterCandidate = {
	readonly kind: SharedCallableKind;
	readonly nodes: readonly SharedParameterNode[];
	readonly locations: readonly CallableLocation[];
	readonly support: number;
};
export type SharedParameterAnalysisInput = {
	readonly file: string;
	readonly kind: SharedCallableKind;
	readonly nodes: readonly SharedParameterNodeInput[];
	readonly project_types: ReadonlySet<string>;
	readonly reference_aliases: readonly AstReferenceAlias[];
	readonly language: SharedParameterLanguage;
};
export type MutableParameterNode = {
	readonly key: string;
	readonly identity: string;
	readonly kind: SharedParameterKind;
	readonly project_type: boolean;
	readonly locations: Map<string, CallableLocation>;
};
