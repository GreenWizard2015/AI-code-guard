import type { AstArgumentUse, AstClassField, AstStatementNode, AstTypedArgument } from "src/types";
import type { TestDataFactory } from "tests/core/test-data-factory";

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
