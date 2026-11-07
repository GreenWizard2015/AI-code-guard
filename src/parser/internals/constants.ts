import ts from "typescript";

export const BROAD_CATCH = "broad-except";
export const VM_RUN_IN_CONTEXT_NAME = "runInContext";
export const TYPEOF = "typescript-typeof";
export const INSTANCEOF = "typescript-instanceof";
export const GETATTR = "getattr";
export const SETATTR = "setattr";
export const COMPLEX_DEFAULT = "complex-default-parameter";
export const PARAMETER_PROPERTY = "typescript-parameter-property";
export const LARGE_UNION = "large-union";
export const INTERFACE_RULE_ID = "typescript-interface-shape";
export const LOGICAL_ASSIGNMENT = "typescript-logical-assignment";
export const TERNARY = "ternary-expression";
export const CONDITIONAL_EXECUTION = "conditional-execution";
export const POINTLESS_BOOLEAN_OPERATION = "pointless-boolean-operation";
export const TS_BLOCK = "typescript-conditional-block";
export const EARLY_RETURN = "early-return";
export const NULLABLE_DOMAIN_TYPE = "nullable-domain-type";
export const SINGULAR_PLURAL_ALIAS = "typescript-singular-plural-alias";
export const EXCEPTION_RAISING = "exception-raising";
export const SINGLE_ARRAY_STATE = "single-item-array-state";
export const UNION_CONTRACT_BYPASS = "typescript-union-contract-bypass";
export const REST_UNION_CONTRACT = "typescript-rest-union-contract";
export const TYPE_ASSERTION = "typescript-type-assertion";
export const COMPOSITE_STATE_TYPE = "composite-state-type";
export const BOUNDARY_RULE_NODE_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
	ts.SyntaxKind.InterfaceDeclaration,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.PropertyDeclaration,
	ts.SyntaxKind.BinaryExpression,
	ts.SyntaxKind.CallExpression,
	ts.SyntaxKind.PropertyAccessExpression,
	ts.SyntaxKind.ElementAccessExpression,
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.ArrowFunction,
	ts.SyntaxKind.FunctionExpression,
	ts.SyntaxKind.ConditionalExpression,
	ts.SyntaxKind.IfStatement,
	ts.SyntaxKind.Parameter,
	ts.SyntaxKind.PropertySignature,
	ts.SyntaxKind.UnionType,
	ts.SyntaxKind.IntersectionType,
	ts.SyntaxKind.ThrowStatement,
	ts.SyntaxKind.MethodSignature,
	ts.SyntaxKind.WhileStatement,
	ts.SyntaxKind.DoStatement,
	ts.SyntaxKind.ForStatement,
	ts.SyntaxKind.CatchClause,
	ts.SyntaxKind.TypeOfExpression,
	ts.SyntaxKind.TypeAssertionExpression,
	ts.SyntaxKind.AsExpression,
]);
export const BASIC_ALIAS_NODE_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
	ts.SyntaxKind.PropertyDeclaration,
	ts.SyntaxKind.PropertySignature,
	ts.SyntaxKind.InterfaceDeclaration,
]);
export const EXPRESSION_RULE_FLAGS = {
	declaration: 1,
	operator: 2,
	terminal: 4,
} as const;
export const EXPRESSION_RULE_FLAGS_BY_KIND: ReadonlyMap<ts.SyntaxKind, number> = new Map([
	[ts.SyntaxKind.FunctionDeclaration, EXPRESSION_RULE_FLAGS.declaration],
	[ts.SyntaxKind.MethodDeclaration, EXPRESSION_RULE_FLAGS.declaration],
	[ts.SyntaxKind.GetAccessor, EXPRESSION_RULE_FLAGS.declaration],
	[ts.SyntaxKind.MethodSignature, EXPRESSION_RULE_FLAGS.declaration],
	[ts.SyntaxKind.ArrowFunction, EXPRESSION_RULE_FLAGS.declaration],
	[ts.SyntaxKind.FunctionExpression, EXPRESSION_RULE_FLAGS.declaration],
	[ts.SyntaxKind.IfStatement, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.WhileStatement, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.DoStatement, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.ForStatement, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.ConditionalExpression, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.BinaryExpression, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.CallExpression, EXPRESSION_RULE_FLAGS.operator],
	[ts.SyntaxKind.CatchClause, EXPRESSION_RULE_FLAGS.terminal],
	[ts.SyntaxKind.TypeOfExpression, EXPRESSION_RULE_FLAGS.terminal],
	[ts.SyntaxKind.TypeAssertionExpression, EXPRESSION_RULE_FLAGS.terminal],
	[ts.SyntaxKind.AsExpression, EXPRESSION_RULE_FLAGS.terminal],
]);
export const INDEX_SIGNATURE = "typescript-index-signature";
export const UNBOUNDED_TYPE = "unbounded-type";
export const DYNAMIC_RUNTIME_USAGE = "typescript-dynamic-runtime-usage";
export const OVERLOAD = "typescript-overload";
export const EQUALITY_COMPARISON_OPERATOR_KINDS: readonly ts.SyntaxKind[] = [
	ts.SyntaxKind.EqualsEqualsToken,
	ts.SyntaxKind.EqualsEqualsEqualsToken,
];
export const COMPARISON_OPERATOR_KINDS: readonly ts.SyntaxKind[] = [
	...EQUALITY_COMPARISON_OPERATOR_KINDS,
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
