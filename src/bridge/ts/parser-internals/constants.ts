import ts from 'typescript';

export const BROAD_CATCH = 'broad-except';
export const TYPEOF = 'typescript-typeof';
export const INSTANCEOF = 'typescript-instanceof';
export const GETATTR = 'getattr';
export const SETATTR = 'setattr';
export const COMPLEX_DEFAULT = 'complex-default-parameter';
export const PARAMETER_PROPERTY = 'typescript-parameter-property';
export const LARGE_UNION = 'large-union';
export const INTERFACE_RULE_ID = 'typescript-interface-shape';
export const LOGICAL_ASSIGNMENT = 'typescript-logical-assignment';
export const SWITCH = 'switch';
export const TERNARY = 'ternary-expression';
export const CONDITIONAL_EXECUTION = 'conditional-execution';
export const TS_BLOCK = 'typescript-conditional-block';
export const NULLABLE_DOMAIN_TYPE = 'nullable-domain-type';
export const SINGULAR_PLURAL_ALIAS = 'singular-plural-alias';
export const EXCEPTION_RAISING = 'exception-raising';
export const SINGLE_ARRAY_STATE = 'single-item-array-state';
export const UNION_CONTRACT_BYPASS = 'typescript-union-contract-bypass';
export const REST_UNION_CONTRACT = 'typescript-rest-union-contract';
export const TYPE_ASSERTION = 'typescript-type-assertion';
export const COMPOSITE_STATE_TYPE = 'composite-state-type';
export const INDEX_SIGNATURE = 'typescript-index-signature';
export const UNBOUNDED_TYPE = 'unbounded-type';
export const DYNAMIC_RUNTIME_USAGE = 'typescript-dynamic-runtime-usage';
export const OVERLOAD = 'typescript-overload';
export const COMPARISON_OPERATOR_KINDS: readonly ts.SyntaxKind[] = [
	ts.SyntaxKind.EqualsEqualsToken,
	ts.SyntaxKind.EqualsEqualsEqualsToken,
	ts.SyntaxKind.ExclamationEqualsToken,
	ts.SyntaxKind.ExclamationEqualsEqualsToken,
	ts.SyntaxKind.LessThanToken,
	ts.SyntaxKind.LessThanEqualsToken,
	ts.SyntaxKind.GreaterThanToken,
	ts.SyntaxKind.GreaterThanEqualsToken,
	ts.SyntaxKind.InKeyword,
	ts.SyntaxKind.InstanceOfKeyword,
];
export const BOOLEAN_OPERATOR_KINDS: readonly ts.SyntaxKind[] = [
	ts.SyntaxKind.AmpersandAmpersandToken,
	ts.SyntaxKind.BarBarToken,
];
