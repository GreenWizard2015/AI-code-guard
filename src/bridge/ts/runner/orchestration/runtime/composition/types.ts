import ts from 'typescript';
import type { CallableClassIndex, CallableDefinition, CallableProjectIndex, ParsedFile } from 'src/metrics/types';
import type { CodeClass, ImportedSymbol } from 'src/types';
import type { CallableMethodCounts } from 'src/bridge/ts/runner/orchestration/runtime/callable-method-counts';
import type { CallableReferenceIndex } from 'src/metrics/callable-reference-index';

export type CallableUsageCollectorState = {
	parsed_files: ParsedFile[];
	production_files: ParsedFile[];
	definitions: CallableDefinition[];
	method_counts: CallableMethodCounts;
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	reference_index: CallableReferenceIndex;
};

export type CallableIndexes = {
	project_types: CallableProjectIndex;
	class_nodes: CallableClassIndex;
	reference_index: CallableReferenceIndex;
};

export type TypeScriptComposition = {
	classes: CodeClass[];
	imports: Map<string, ImportedSymbol>;
};

export type LocalImport = { clause: ts.ImportClause; file: string };
export type UsageData = { used_locally: boolean; external_files: Set<string> };
export type NamedDeclaration = { name: string; line: number; has_self: boolean };
