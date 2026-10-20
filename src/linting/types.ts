import type { ViolationContract } from "src/reporting_protocols";
import type ts from "typescript";
import type { LintFileNameContract } from "src/source_types";
import type {
	LineDepth,
	AstCallableNodeContract,
	AstClassNode,
	AstParseIssue,
	AstPythonImport,
	AstReferenceAlias,
	NamedLine,
	NamedSymbol,
} from "src/types";

export type TypeScriptVariableDeclarationsByName = ReadonlyMap<string, readonly ts.VariableDeclaration[]>;

export type PythonOperationInput = {
	callables: AstCallableNodeContract[];
	attribute_accesses: LineDepth[];
	private_accesses: { line: number }[];
	repeated_branches: { line: number }[];
	functions: AstCallableNodeContract[];
	parse_issues: AstParseIssue[];
	named_symbols: NamedSymbol[];
	symbol_references: NamedLine[];
};

type PythonRuleDiagnostics = {
	violations: ViolationContract[];
	file_name: LintFileNameContract;
};

type PythonRuleAstInput = {
	classes: AstClassNode[];
	functions: AstCallableNodeContract[];
	reference_aliases: AstReferenceAlias[];
	python_imports: AstPythonImport[];
	operations: PythonOperationInput;
};

type PythonRuleProjectNames = {
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
};

type PythonRuleOptions = {
	suppress_short_class: boolean;
	production_import_names: ReadonlySet<string>;
};

export type PythonRuleInput = PythonRuleDiagnostics & PythonRuleAstInput & PythonRuleProjectNames & PythonRuleOptions;
