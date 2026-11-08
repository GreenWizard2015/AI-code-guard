import type { SpawnOptions } from "node:child_process";
import type { LintRunConfiguration } from "src/core/lint_run_configuration";
import type { TaskReviewAgent } from "src/core/support/task/reporting/workspace/review/task_review_agent";
import type { LintReportMode, LintReportOptions } from "src/core/types";
import type { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import type {
	AstArgumentUse,
	AstClassField,
	AstStatementNode,
	AstTypedArgument,
	NamedLine,
} from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { PythonAstWorkerCapabilityContract, PythonAstWorkerContract } from "src/python_protocols";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";
import type { TestDataFactory } from "tests/core/test-data-factory";
import type ts from "typescript";

export type CallablePathAction<Result> = () => Result;
export type CallableLintRequest<Result> = (
	configuration: LintRunConfiguration,
	options: LintReportOptions,
	mode: LintReportMode,
) => Result;
export type ProjectSourceFixtureContext = {
	root: string;
	context: LintProjectContextContract;
	files: readonly string[];
	source_texts: Map<string, string>;
	stage_timer: LintStageTimerContract;
};
export type CallableProjectSourceAction<Result> = (fixture: ProjectSourceFixtureContext) => Result;
export type CallableTaskReviewAgentFactory = () => TaskReviewAgent;
export type CallableInterleaving = () => void;
export type CallableTaskReportingAction<Result> = (fixture: TaskReportingMemoryWorkspace) => Result;
export type TaskDocuments = { output: string; issues: string; report: string };
export type CallableNodeVisitor = (node: ts.Node) => void;
export type CallablePythonAstWorkerFactory = (
	arguments_list: string[],
	options: SpawnOptions,
) => PythonAstWorkerContract;
export type CallablePythonAstWorkerProvider = () => PythonAstWorkerCapabilityContract;

export type PreparedPythonLintInput = {
	readonly source_record: LintSourceRecordData;
	readonly source_ast: SourceFileAst;
	readonly module_exports_context: TypeScriptModuleExportsContext;
};

export type AstClassFieldPatch = Partial<AstClassField>;

export type SharedParameterInputs = {
	callables: ReturnType<TestDataFactory["analyzed_callable"]>[];
	factory: TestDataFactory;
};
export type Fixture = { root: string; paths: string[]; source_texts: ReadonlyMap<string, string> };
type FixtureCallableShape = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
	owner: string;
	lines: number;
	sloc: number;
	characters: number;
	control_flow_depth: number;
	statements: readonly AstStatementNode[];
	parameter_types: readonly string[];
	untyped_parameters: readonly string[];
	return_type: string;
	argument_uses: readonly AstArgumentUse[];
	typed_arguments: readonly AstTypedArgument[];
	decorators: readonly string[];
	parameterized_case_count: number;
	is_accessor: boolean;
	exception_only: boolean;
	has_self: boolean;
	has_unittest_assertion: boolean;
	unittest_assertion_alias: boolean;
	unittest_exception_only: boolean;
	test_exception_bypass: boolean;
	unittest_ending_valid: boolean;
	unittest_assertion_count: number;
	visibility: string;
};
export type FixtureCallableNode = Partial<FixtureCallableShape>;
type FixtureClassShape = {
	name: string;
	start: number;
	end: number;
	methods: FixtureCallableNode[];
	fields: AstClassFieldPatch[];
	untyped_fields: readonly NamedLine[];
	lines: number;
	sloc: number;
	interfaces: readonly string[];
	base_class_names: readonly string[];
	extends_external_class: boolean;
	is_data_class: boolean;
	type_contract: boolean;
	protocol: boolean;
	callback_fields: number;
	inline_callback_fields: number;
	dependencies: readonly string[];
};
export type FixtureClassNode = Partial<FixtureClassShape>;
