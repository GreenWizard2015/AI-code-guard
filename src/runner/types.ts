import type { Violation } from 'src/protocols';
import type {
	LineDepth,
	AstCallableNode,
	AstClassNode,
	AstParseIssue,
	AstPythonImport,
	AstReferenceAlias,
	LintFileNameContract,
	NamedSymbol,
} from 'src/types';

export type PythonOperationInput = {
	callables: AstCallableNode[];
	attribute_accesses: LineDepth[];
	private_accesses: { line: number }[];
	repeated_branches: { line: number }[];
	functions: AstCallableNode[];
	parse_issues: AstParseIssue[];
	named_symbols: NamedSymbol[];
};

export type PythonRuleInput = {
	violations: Violation[];
	file_name: LintFileNameContract;
	classes: AstClassNode[];
	functions: AstCallableNode[];
	project_class_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	reference_aliases: AstReferenceAlias[];
	python_imports: AstPythonImport[];
	operations: PythonOperationInput;
	suppress_short_class: boolean;
};

export type PythonRuleAppender = (input: PythonRuleInput) => void;
