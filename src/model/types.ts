import ts from 'typescript';
import type { AstTypeKind, AstVisibility, ImportedFunction } from 'src/types';
import type { TypeScriptPropertyState } from 'src/model/typescript-property-state';

export type TypeScriptClassFieldContext = {
	file: string;
	relative_file: string;
	source_file: ts.SourceFile;
	imports: Map<string, ImportedFunction>;
	functions: Map<string, Set<string>>;
};

export type FieldAssignment = { field: string; name: string };

export type DestructuredInstanceOptions = {
	node: ts.VariableDeclaration;
	initializer: ts.Expression;
	current_owner: string;
	source_file: ts.SourceFile;
	property_state: TypeScriptPropertyState;
};
export type TypeScriptSourceResolver = (file: string) => ts.SourceFile[];
export type TypeScriptAstOptions = {
	source_file: ts.SourceFile;
	source_resolver: TypeScriptSourceResolver;
};
/** Responsibilities: _kind TypeScript traversal representation_. **/
export enum ResponsibilityContainerKind {
	Class = 'class',
	Interface = 'interface',
	Root = 'root',
}
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
	argument_uses: ArgumentUse[];
	typed_arguments: TypedArgument[];
	argument_count: number;
	parameter_types: string[];
	return_type: string;
};
export type DestructuredAlias = { name: string; owner: string };
export type TypeScriptReferenceShape = {
	readonly name: string;
	readonly arguments: readonly ts.TypeNode[];
};
export type CallableNodeContext = { readonly source_file: ts.SourceFile };
export type TypeScriptTypeDetails = {
	readonly union: boolean;
	readonly union_types: readonly ts.TypeNode[];
	readonly parenthesized_type: readonly ts.TypeNode[];
	readonly is_function: boolean;
	readonly reference_name: string;
	readonly reference_arguments: readonly ts.TypeNode[];
};
