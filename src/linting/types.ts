import type { LintFileNameContract } from "src/core/support/protocols";
import type {
	AstCallableNode,
	AstClassNode,
	AstParseIssue,
	AstPythonImport,
	AstReferenceAlias,
	LineDepth,
	NamedLine,
	NamedSymbol,
} from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type ts from "typescript";

/** Responsibilities: _preferred visible declaration_. **/
export type PreferredVariableDeclaration = {
	found: boolean;
	declaration: ts.Node;
	scope_index: number;
};

export type TypeScriptVariableDeclarationsByName = Map<string, ts.VariableDeclaration[]>;

export type PythonOperationInput = {
	callables: AstCallableNode[];
	methods: AstCallableNode[];
	attribute_accesses: LineDepth[];
	private_accesses: { line: number }[];
	repeated_branches: { line: number }[];
	functions: AstCallableNode[];
	parse_issues: AstParseIssue[];
	named_symbols: NamedSymbol[];
	symbol_references: NamedLine[];
};

/** Responsibilities: _complete Python rule input_. **/
export type PythonProjectTypeNames = {
	readonly classes: ReadonlySet<string>;
	readonly protocols: ReadonlySet<string>;
	readonly types: ReadonlySet<string>;
	readonly type_aliases: ReadonlySet<string>;
};

export type PythonRuleSource = {
	readonly text: string;
	readonly classes: AstClassNode[];
	readonly type_declarations: NamedLine[];
	readonly functions: AstCallableNode[];
	readonly reference_aliases: AstReferenceAlias[];
	readonly python_imports: AstPythonImport[];
};

export type PythonRuleProjectContext = {
	readonly classes: ReadonlySet<string>;
	readonly protocols: ReadonlySet<string>;
	readonly types: ReadonlySet<string>;
	readonly type_aliases: ReadonlySet<string>;
	readonly suppress_short_class: boolean;
	readonly production_import_names: ReadonlySet<string>;
};

export type PythonRuleInput = {
	readonly violations: ViolationContract[];
	readonly file_name: LintFileNameContract;
	readonly source: PythonRuleSource;
	readonly operations: PythonOperationInput;
	readonly project: PythonRuleProjectContext;
};
