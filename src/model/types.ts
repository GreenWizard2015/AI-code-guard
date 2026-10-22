import ts from "typescript";
import { MODULE_CLASS_KIND, MODULE_INTERFACE_KIND, MODULE_ROOT_KIND } from "src/constants";
import type { TypeScriptTreeMetadata } from "src/source_types";
import type {
	AstCallableNodeContract,
	AstCallableReference,
	AstClassNodeContract,
	AstImportIssue,
	AstParseIssue,
	AstLiteralConstant,
	AstLiteralReference,
	AstReferenceAlias,
	AstResponsibilityTarget,
	AstSourceSpan,
	AstTypeKind,
	AstTypeMembers,
	AstVisibility,
	LineDepth,
	NamedLine,
	NamedSymbol,
} from "src/types";
import type { TypeScriptPropertyStateContract } from "src/model/protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { SourceLineResolver } from "src/runtime_types";
import type { StringSetMap } from "src/analysis_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptMetadataNodeVisitor } from "src/typescript_analysis_types";
import type { ImportedFunction } from "src/types";

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
	source_resolver: TypeScriptSourceResolver;
	source_io: ProjectSourceIOContract;
	project_root: string;
	stage_timer: LintStageTimerContract;
};
export type TypeScriptCallReferenceCollectorOptions = {
	source_file: ts.SourceFile;
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
export type TypeScriptLiteralMetadataResult = {
	references: AstLiteralReference[];
	constants: AstLiteralConstant[];
};
export type TypeScriptReferenceMetadata = {
	symbol_references: NamedLine[];
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
};
export type TreeMetadataState = {
	import_issues: AstImportIssue[];
	type_declarations: NamedLine[];
	named_symbols: NamedSymbol[];
	symbol_references: NamedLine[];
	attribute_accesses: LineDepth[];
};

export type TypeScriptMetadataCollectionOptions = {
	line_for: SourceLineResolver;
	state: TreeMetadataState;
	literal_references: AstLiteralReference[];
	literal_constants: AstLiteralConstant[];
	on_node: TypeScriptMetadataNodeVisitor;
};
export type TypeScriptDerivedMetadata = {
	parse_issues: AstParseIssue[];
	call_references: AstCallableReference[];
	responsibility_targets: AstResponsibilityTarget[];
	reference_aliases: AstReferenceAlias[];
	type_members: AstTypeMembers;
};
export type TypeScriptNormalizedMetadataOptions = {
	classes: AstClassNodeContract[];
	functions: AstCallableNodeContract[];
	tree: TypeScriptTreeMetadata;
	spans: TypeScriptMetadataSpans;
	derived: TypeScriptDerivedMetadata;
};
export type TypeScriptDeclarationMetadata = {
	language: "typescript";
	classes: AstClassNodeContract[];
	functions: AstCallableNodeContract[];
	import_issues: AstImportIssue[];
	attribute_accesses: LineDepth[];
	named_symbols: NamedSymbol[];
	type_declarations: NamedLine[];
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
