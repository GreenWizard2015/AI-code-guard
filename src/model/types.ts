import type { StringSetMap } from "src/analysis_types";
import { MODULE_CLASS_KIND, MODULE_INTERFACE_KIND, MODULE_ROOT_KIND } from "src/constants";
import type {
	AstCallableNode,
	AstCallableReference,
	AstClassField,
	AstClassNode,
	AstClassNodeClassification,
	AstClassNodeFieldAnalysis,
	AstClassNodeStructure,
	AstImportIssue,
	AstLiteralConstant,
	AstLiteralReference,
	AstParseIssue,
	AstReferenceAlias,
	AstResponsibilityTarget,
	AstSourceSpan,
	AstTypeKind,
	AstTypeMembers,
	AstVisibility,
	LineDepth,
	NamedLine,
	NamedSymbol,
} from "src/model/ast/normalized_ast_types";
import type { ImportedFunction } from "src/model/ast/normalized_ast_types";
import type { TypeScriptClassCallableNodesContract, TypeScriptPropertyStateContract } from "src/model/protocols";
import type { CallableSourceLineResolver } from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptTreeMetadata } from "src/source_types";
import type { TypeScriptClassMembersContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _diagnostic rule metadata_. **/
export type TaskReportDiagnosticScope = "directory" | "file-placement" | "unclassified";

export type DiagnosticRuleData = {
	readonly message: string;
	readonly hint: string;
	readonly priority: number;
	readonly task_report_scope: TaskReportDiagnosticScope;
};

/** Responsibilities: _reference query classification_. **/
export enum TypeScriptReferenceQueryKind {
	CallOwner = "call-owner",
	PropertyOwner = "property-owner",
	CallOrPropertyOwner = "call-or-property-owner",
	MethodReference = "method-reference",
}

export type TypeScriptMetadataSourceLocation = { readonly line: number };

export enum TypeScriptReferenceOwnerQueryKind {
	CallOwner = "call-owner",
	PropertyOwner = "property-owner",
	CallOrPropertyOwner = "call-or-property-owner",
}

export type TypeScriptClassFieldContext = {
	file: string;
	relative_file: string;
	source_file: ts.SourceFile;
	imports: Map<string, ImportedFunction>;
	functions: StringSetMap;
};

export type FieldAssignment = { field: string; name: string };

export type DestructuredInstanceOptions = {
	node: ts.VariableDeclaration;
	initializer: ts.Expression;
	current_owner: string;
	source_file: ts.SourceFile;
	property_state: TypeScriptPropertyStateContract;
};
export type TypeScriptSourceResolver = ReadonlyMap<string, ts.SourceFile>;
export type TypeScriptAstOptions = {
	source_file: ts.SourceFile;
	traversal: TypeScriptAstTraversalContract;
	source_resolver: ReadonlyMap<string, ts.SourceFile>;
	source_io: ProjectSourceIOContract;
	project_root: string;
	stage_timer: LintStageTimerContract;
};
export type TypeScriptCallReferenceCollectorOptions = {
	source_file: ts.SourceFile;
	declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
	project_root: string;
	stage_timer: LintStageTimerContract;
	source_files: TypeScriptSourceResolver;
	traversal: TypeScriptAstTraversalContract;
	source_io: ProjectSourceIOContract;
};
export type TypeScriptMetadataSpans = {
	module_constant_spans: AstSourceSpan[];
	module_type_spans: AstSourceSpan[];
	module_protocol_spans: AstSourceSpan[];
};
export type TypeScriptAstDeclarationMetadataOptions = {
	source_file: ts.SourceFile;
	stage_timer: LintStageTimerContract;
};
export type TypeScriptClassMemberMetrics = {
	lines: number;
	sloc: number;
};
export type TypeScriptClassHeritage = {
	interfaces: string[];
	base_class_names: string[];
};
/** Responsibilities: _class node structure_. **/
export type TypeScriptClassNodeStructure = {
	readonly interfaces: string[];
	readonly base_class_names: readonly string[];
	readonly methods: AstCallableNode[];
	readonly fields: AstClassField[];
	readonly dependencies: string[];
};
/** Responsibilities: _class analysis state_. **/
export type TypeScriptClassNodeAnalysis = {
	readonly extends_external_class: boolean;
	readonly is_data_class: boolean;
	readonly type_contract: boolean;
	readonly protocol: boolean;
	readonly callback_fields: number;
	readonly inline_callback_fields: number;
	readonly untyped_fields: NamedLine[];
};
/** Responsibilities: _class node features_. **/
export type TypeScriptClassNodeFeatures = {
	readonly structure: TypeScriptClassNodeStructure;
	readonly analysis: TypeScriptClassNodeAnalysis;
};
export type TypeScriptClassAstSections = {
	structure: AstClassNodeStructure;
	classification: AstClassNodeClassification;
	field_analysis: AstClassNodeFieldAnalysis;
};
export type TreeMetadataState = {
	import_issues: AstImportIssue[];
	type_declarations: NamedLine[];
	named_symbols: NamedSymbol[];
	symbol_references: NamedLine[];
	attribute_accesses: LineDepth[];
};

export type TypeScriptMetadataCollectionOptions = {
	state: TreeMetadataState;
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
	line_for: CallableSourceLineResolver;
};
export type TypeScriptDerivedMetadata = {
	parse_issues: AstParseIssue[];
	call_references: AstCallableReference[];
	responsibility_targets: AstResponsibilityTarget[];
	reference_aliases: AstReferenceAlias[];
	type_members: AstTypeMembers;
};
export type TypeScriptNormalizedFileParts = {
	readonly classes: AstClassNode[];
	readonly functions: AstCallableNode[];
	readonly tree: TypeScriptTreeMetadata;
	readonly derived: TypeScriptDerivedMetadata;
	readonly spans: TypeScriptMetadataSpans;
};
/** Responsibilities: _kind TypeScript traversal representation_. **/
export const RESPONSIBILITY_CONTAINER_KIND = {
	Class: MODULE_CLASS_KIND,
	Interface: MODULE_INTERFACE_KIND,
	Root: MODULE_ROOT_KIND,
} as const;
export type ResponsibilityContainerKind = "class" | "interface" | "root";
export type ResponsibilityContainer = { kind: ResponsibilityContainerKind; line: number };
export type SourceLineRange = { start: number; end: number };
export type CallableDataOptions = {
	name: string;
	node: ts.SignatureDeclarationBase;
	visibility: AstVisibility;
	owner: string;
};
export type ClassCallableNodeOptions = {
	member: ts.ClassElement;
	callable: ts.FunctionLikeDeclaration;
	name: string;
	owner: string;
};
export type TypeScriptClassDeclarationMetadataOptions = {
	class_declaration: ts.ClassLikeDeclaration;
	fallback_name: string;
	source_file: ts.SourceFile;
	callable_nodes: TypeScriptClassCallableNodesContract;
	member_data: TypeScriptClassMembersContract;
};
export type ArgumentUse = { name: string; count: number };
export type TypedArgument = { name: string; type: string; kind: AstTypeKind };
export type CallableTypeData = { parameter_types: string[]; return_type: string };
export type CallableNodeMetrics = {
	lines: number;
	sloc: number;
	characters: number;
	control_flow_depth: number;
	argument_uses: ArgumentUse[];
	typed_arguments: TypedArgument[];
	argument_count: number;
	parameter_types: string[];
	return_type: string;
};
export type DestructuredAlias = { name: string; owner: string };
export type TypeScriptInstanceLookup = { readonly bound: boolean; readonly value: string };
export type TypeScriptReferenceShape = {
	readonly name: string;
	readonly arguments: readonly ts.TypeNode[];
};
export type TypeScriptTypeDetails = {
	readonly union: boolean;
	readonly union_types: readonly ts.TypeNode[];
	readonly parenthesized_type: readonly ts.TypeNode[];
	readonly is_function: boolean;
	readonly reference_name: string;
	readonly reference_arguments: readonly ts.TypeNode[];
};
