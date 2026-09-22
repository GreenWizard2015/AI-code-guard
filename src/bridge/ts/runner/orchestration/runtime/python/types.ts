import type { PythonRuleAppender } from 'src/runner/types';
import type { LintFileNameContract, NormalizedAstFile } from 'src/types';
import type { LintSourceRecord } from 'src/types';

export type NamedDeclaration = { name: string; line: number; has_self: boolean };
export type LineViolation = { line: number };
export type SimpleViolationGroup = { items: LineViolation[]; rule_id: string };
export type PythonAstFileRuleCollectorOptions = {
	ast: NormalizedAstFile;
	file_name: LintFileNameContract;
	lines: string[];
	project_class_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	append: PythonRuleAppender;
};
export type PythonLintInput = {
	file_name: LintFileNameContract;
	text: string;
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	normalized_ast: NormalizedAstFile;
};
export type PythonProjectNames = {
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
};
export type PythonTestFramework = 'pytest' | 'unittest';
export type TestFrameworkFile = { source: LintSourceRecord; framework: PythonTestFramework };
