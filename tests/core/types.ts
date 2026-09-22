import type { SharedParameterAnalyzer } from "src/metrics/shared-parameter-analyzer";
import type { TestDataFactory } from "tests/core/test-data-factory";
import type {
	AstArgumentUse,
	AstClassField,
	AstStatementNode,
	AstTypedArgument,
} from "src/types";
import type { TaskReporting } from "src/bridge/ts/core/support/task-reporting";

export type AnalyzerCase = {
	analyzer: SharedParameterAnalyzer;
	factory: TestDataFactory;
};
export type Fixture = { root: string; paths: string[] };
export type TemporaryFilesCallback<T> = (
	root: string,
	reporting: TaskReporting,
) => T;
export type TestRunnerRequest = {
	readonly args: readonly string[];
	readonly help_requested: boolean;
	readonly headless: boolean;
	readonly skip_quality: boolean;
};
export type QualityCheck = {
	readonly label: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly environment: NodeJS.ProcessEnv;
};
type FixtureCallableShape = {
	name: string;
	start: number;
	end: number;
	argument_count: number;
	owner: string;
	lines: number;
	sloc: number;
	characters: number;
	statements: readonly AstStatementNode[];
	parameter_types: readonly string[];
	untyped_parameters: readonly string[];
	return_type: string;
	argument_uses: readonly AstArgumentUse[];
	typed_arguments: readonly AstTypedArgument[];
	decorators: readonly string[];
	is_accessor: boolean;
	exception_only: boolean;
	has_self: boolean;
	has_unittest_assertion: boolean;
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
	fields: Array<Partial<AstClassField>>;
	lines: number;
	sloc: number;
	interfaces: readonly string[];
	base_class_name: string;
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
