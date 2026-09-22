import type { Violation } from 'src/protocols';
import type { LintProjectContext } from 'src/protocols';
import type { LintStageTimer } from 'src/bridge/ts/core/stage-timing';

export type TypeMemberEntry = { name: string; members: Record<string, string> };

export type LintRunState = {
	repo_root: string;
	files: string[];
	ignored_files: ReadonlySet<string>;
	project_files: string[];
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
	context: LintProjectContext;
};

export type LintRunResult = {
	files: string[];
	violations: Violation[];
};

export type LintAnalysisStage = {
	state: LintRunState;
	stage_timer: LintStageTimer;
};
