import type { RuleParameters } from 'src/types';
import type {
	AstClassNode,
	AstSourceSpan,
	ImportedFunction,
	NormalizedAstFile,
} from 'src/types';
import type { Violation } from 'src/protocols';

export type ParsedClassFile = { file: string; ast: NormalizedAstFile };
export type ClassDefinition = { file: string; node: AstClassNode };
export type ViolationContent = {
	rule_id: string;
	parameters: RuleParameters;
};
export type ContractKind = 'interface' | 'protocol';
export type DirectoryFileViolationOptions = {
	violations: Violation[];
	file: string;
	text: string;
	classes: readonly AstClassNode[];
	docstring_spans: readonly AstSourceSpan[];
	normalized_ast: NormalizedAstFile;
};
export type DirectoryViolationContext = {
	files: string[];
	repo_root: string;
	class_counts: ReadonlyMap<string, number>;
	source_asts: ReadonlyMap<string, NormalizedAstFile>;
};
export type ClassField = { line: number; name: string; value_name: string };
export type FieldContext = {
	repo_root: string;
	imports: Map<string, ImportedFunction>;
	function_by_file: Map<string, Set<string>>;
};
export type ClassSummaryOptions = {
	violations: Violation[];
	file: string;
	lines: string[];
	python: boolean;
	parsed_indexes: number[];
	has_module_functions: boolean;
};
