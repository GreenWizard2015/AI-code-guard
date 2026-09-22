import type { LintProjectContext, Violation } from 'src/protocols';
import type { LintFileNameContract, LintSourceRecord, NormalizedAstFile } from 'src/types';
import type { TypeScriptAstFile } from 'src/model/typescript-ast';
import type { AstStatementNode } from 'src/types';
import ts from 'typescript';
import type { RuleParameters } from 'src/types';
import type { TypeScriptReferenceContext } from 'src/typescript-reference-context';

export type FileLinterOptions = {
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	context: LintProjectContext;
	ignored_files: ReadonlySet<string>;
};
export type TypeScriptScannerOptions = {
	file_name: LintFileNameContract;
	text: string;
	project_class_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	ast_file: TypeScriptAstFile;
};
export type TypeScriptScannerRuleContext = {
	file_name: LintFileNameContract;
	project_class_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	lines: string[];
	ast_file: TypeScriptAstFile;
	ast: NormalizedAstFile;
};
export type LintResult = { source: LintSourceRecord; violations: Violation[] };

export type ResponsibilityValues = { present: boolean; values: string[]; format_valid: boolean };
export type ResponsibilityLimits = { minimum: number; maximum: number };

export type CodeClass = {
	key: string;
	file: string;
	line: number;
	name: string;
	dependencies: string[];
};
export type ImportedSymbol = { file: string; name: string };
export type ClassGraph = {
	classes: Map<string, CodeClass>;
	classes_by_file: Map<string, Map<string, CodeClass>>;
	imports_by_file: Map<string, Map<string, ImportedSymbol>>;
};
export type CompositionResult = {
	classes: CodeClass[];
	imports: Map<string, ImportedSymbol>;
};
export type PythonAssignment = {
	line: number;
	name: string;
	simple_alias: boolean;
	destructured: boolean;
};
export type ReturnViolationContext = {
	violations: Violation[];
	file: string;
	candidates: PythonAssignment[];
	kind: PythonAssignmentKind;
	name: string;
};
type PythonAssignmentKind = 'assignment' | 'return' | 'other';
export type StatementContext = {
	violations: Violation[];
	file: string;
	candidates: PythonAssignment[];
	statement: AstStatementNode;
};
export type CountViolation = {
	file: string;
	first_line: number;
	rule_id: string;
	parameters: RuleParameters;
};
export type CountInput = { file: string; count: number; first_line: number };
export type PrivateMembers = Map<string, Set<string>>;
export type PrivateWalkOptions = {
	violations: Violation[];
	file: string;
	source_file: ts.SourceFile;
	members: PrivateMembers;
	context: TypeScriptReferenceContext;
};
export type PrivateAccessOptions = {
	access: ts.PropertyAccessExpression;
	current_owner: string;
	members: PrivateMembers;
	context: TypeScriptReferenceContext;
};
export type Branch = { line: number; name: string };
export type Assignment = {
	line: number;
	name: string;
	initializer: ts.Expression;
	simple_alias: boolean;
	destructured: boolean;
};
export type AssignmentDetails = {
	name: string;
	initializer: ts.Expression;
	simple_alias: boolean;
	destructured: boolean;
};
