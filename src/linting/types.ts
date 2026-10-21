import type { ViolationContract } from "src/reporting_protocols";
import type ts from "typescript";
import type { LintFileNameContract } from "src/source_types";
import type {
	LineDepth,
	AstCallableNodeContract,
	AstClassNodeContract,
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

/** Responsibilities: _Python rule diagnostics_. **/
interface PythonRuleDiagnosticsContract {
	readonly violations: ViolationContract[];
	readonly file_name: LintFileNameContract;
};

/** Responsibilities: _Python rule AST input_. **/
interface PythonRuleAstInputContract {
	readonly classes: AstClassNodeContract[];
	readonly functions: AstCallableNodeContract[];
	readonly reference_aliases: AstReferenceAlias[];
	readonly python_imports: AstPythonImport[];
	readonly operations: PythonOperationInput;
};

/** Responsibilities: _Python project symbol names_. **/
interface PythonRuleProjectNamesContract {
	readonly project_class_names: ReadonlySet<string>;
	readonly project_protocol_names: ReadonlySet<string>;
	readonly project_type_names: ReadonlySet<string>;
};

/** Responsibilities: _Python rule options_. **/
interface PythonRuleOptionsContract {
	readonly suppress_short_class: boolean;
	readonly production_import_names: ReadonlySet<string>;
};

/** Responsibilities: _complete Python rule input_. **/
export interface PythonRuleInputContract
	extends PythonRuleDiagnosticsContract,
		PythonRuleAstInputContract,
		PythonRuleProjectNamesContract,
		PythonRuleOptionsContract {}
