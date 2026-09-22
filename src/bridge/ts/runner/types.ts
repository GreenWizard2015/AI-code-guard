import type ts from 'typescript';
import type { ProjectSourcePython } from 'src/project-source-python';
import type { LintProjectContext } from 'src/protocols';

export type RuleAppender = (node: ts.Node, rule_id: string) => void;
export type PlacementFunctionNode = {
	start: number;
}
export type ValueRule = { condition: boolean; rule_id: string };
export type UnresolvedSpecifierInput = {
	file: string;
	path: string;
	specifier: string;
	files: Set<string>;
	python: ProjectSourcePython;
};

export type ProjectContextState = {
	available: boolean;
	value: LintProjectContext;
};

export type ProjectSourceOptions = {
	context_state: ProjectContextState;
	entry_files: readonly string[];
};
