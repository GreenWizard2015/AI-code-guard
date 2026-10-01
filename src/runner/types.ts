import type { Violation } from "src/protocols";
import type {
	LineDepth,
	AstCallableNode,
	AstClassNode,
	AstParseIssue,
	AstPythonImport,
	AstReferenceAlias,
	LintFileNameContract,
	NamedSymbol,
} from "src/types";

export type PythonOperationInput = {
	callables: AstCallableNode[];
	attribute_accesses: LineDepth[];
	private_accesses: { line: number }[];
	repeated_branches: { line: number }[];
	functions: AstCallableNode[];
	parse_issues: AstParseIssue[];
	named_symbols: NamedSymbol[];
};

type PythonRuleDiagnostics = {
	violations: Violation[];
	file_name: LintFileNameContract;
};

type PythonRuleAstInput = {
	classes: AstClassNode[];
	functions: AstCallableNode[];
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
};

export type PythonRuleInput = PythonRuleDiagnostics & PythonRuleAstInput & PythonRuleProjectNames & PythonRuleOptions;

export type PythonRuleAppender = (input: PythonRuleInput) => void;
