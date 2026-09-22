import type { Violation } from 'src/protocols';
import type { LintFileNameContract } from 'src/types';
import type { AstClassNode, AstLanguage } from 'src/types';
import type { LintRunResult } from 'src/bridge/ts/runtime/types';
import type { LintProjectContext } from 'src/protocols';

export type MaxMethodMetricInput = {
	violations: Violation[];
	file_name: LintFileNameContract;
	node: AstClassNode;
};

export type MixCallableNode = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
};

export type Visibility = 'public' | 'non-public';

export type SourceIdentity = {
	absolute_path: string;
	relative_path: string;
	language: AstLanguage;
};


export type CommentScanResult = { text: string; in_block_comment: boolean };
export type SourceRange = { start: number; end: number };
export type CommentSegment = {
	text: string;
	in_block_comment: boolean;
	result: CommentScanResult;
	complete: boolean;
};

export type ReportViolation = {
	readonly file: string;
	readonly line: number;
	readonly message: string;
	readonly hint: string;
	readonly rule_id: string;
	readonly priority: number;
}

export type ReferenceData = {
	referenced: Set<string>;
	unresolved: Violation[];
};

export type CliOptions = {
	ignored_directories: string[];
	entry_files: string[];
	root: string;
	timings: boolean;
	batch_size: number;
	policy: LintTaskPolicy;
};

export type LintTaskPolicy = 'top-category' | 'all';

export type TaskReportingOptions = {
	batch_size: number;
	policy: LintTaskPolicy;
};

export type LintExecutionReport = {
	context: LintProjectContext;
	report: LintRunResult;
};

export type LintStageDuration = {
	name: string;
	duration_ms: number;
};

export type ProjectNames = {
	project_class_names: ReadonlySet<string>;
	project_protocol_names: ReadonlySet<string>;
	project_contract_names: ReadonlySet<string>;
	project_type_names: ReadonlySet<string>;
};
