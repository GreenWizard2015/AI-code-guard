import type { AstCallableNode } from 'src/types';

export const PROJECT_BOUNDARY_CALLABLE: AstCallableNode = {
	name: 'load', owner: '', nested: false, start: 0, end: 0,
	argument_count: 1, lines: 1, sloc: 1, characters: 1,
	statements: [], parameter_types: ['UserAlias'], return_type: 'User',
	argument_uses: [], typed_arguments: [{ name: 'value', type: 'UserAlias', kind: 'named' }],
	untyped_parameters: [], decorators: [], is_accessor: false,
	has_self: false, visibility: 'public', exception_only: false,
	has_unittest_assertion: false, unittest_assertion_alias: false,
	unittest_exception_only: false, test_exception_bypass: false,
	unittest_ending_valid: false, unittest_assertion_count: 0,
};

export const CONTRACT_BOUNDARY_CALLABLE: AstCallableNode = {
	...PROJECT_BOUNDARY_CALLABLE,
	parameter_types: ['UserPort'],
	return_type: 'UserPort',
	typed_arguments: [{ name: 'value', type: 'UserPort', kind: 'named' }],
};
