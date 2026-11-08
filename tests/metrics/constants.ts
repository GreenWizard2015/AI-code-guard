import type { AstCallableNode } from "src/model/ast/normalized_ast_types";

export const PROJECT_BOUNDARY_CALLABLE: AstCallableNode = {
	identity: { name: "load", owner: "", nested: false, start: 0, end: 0, visibility: "public" },
	metrics: { argument_count: 1, lines: 1, sloc: 1, characters: 1, control_flow_depth: 0 },
	signature: {
		statements: [],
		parameter_types: ["UserAlias"],
		return_type: "User",
		argument_uses: [],
		typed_arguments: [{ name: "value", type: "UserAlias", kind: "named" }],
		untyped_parameters: [],
	},
	test_behavior: {
		exception_only: false,
		has_unittest_assertion: false,
		unittest_assertion_alias: false,
		unittest_exception_only: false,
		test_exception_bypass: false,
		unittest_ending_valid: false,
		unittest_assertion_count: 0,
	},
	declaration: { decorators: [], parameterized_case_count: 0, is_accessor: false, has_self: false },
};

export const CONTRACT_BOUNDARY_CALLABLE: AstCallableNode = {
	...PROJECT_BOUNDARY_CALLABLE,
	signature: {
		...PROJECT_BOUNDARY_CALLABLE.signature,
		parameter_types: ["UserPort"],
		return_type: "UserPort",
		typed_arguments: [{ name: "value", type: "UserPort", kind: "named" }],
	},
};
