import ts from "typescript";
import { JEST_EXCEPTIONS } from "src/constants";
import { JestObjectShapeMatcher } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_object_shape_matcher";
import { JestPropertyAssertionMatcher } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_property_assertion_matcher";
import { JestTypeAssertionMatcher } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_type_assertion_matcher";
import { JestMatcherAccess } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_matcher_access";
import type { JestAssertionMatcherContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _Jest shape assertions matching_, _Jest exception assertions matching_. **/
export class JestAssertionShapeMatcher implements JestAssertionMatcherContract {
	private readonly type_assertion: JestTypeAssertionMatcher;
	private readonly property_assertion: JestPropertyAssertionMatcher;
	private readonly object_shape: JestObjectShapeMatcher;
	private readonly matcher_access: JestMatcherAccess;
	private readonly exception_matchers = JEST_EXCEPTIONS;
	private readonly expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _Jest shape assertions identification_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(expect_aliases: TypeScriptExpressionAliasesContract) {
		this.matcher_access = new JestMatcherAccess();
		this.type_assertion = new JestTypeAssertionMatcher(this.matcher_access);
		this.property_assertion = new JestPropertyAssertionMatcher(this.matcher_access);
		this.object_shape = new JestObjectShapeMatcher(this.matcher_access);
		this.expect_aliases = expect_aliases;
	}
	/** Responsibilities: _public operation_. **/
	public shape_assertion(node: ts.CallExpression): boolean {
		if (this.type_assertion.matches(node, this.expect_aliases)) {
			return true;
		}
		if (this.property_assertion.matches(node, this.expect_aliases)) {
			return true;
		}
		return this.object_shape.shape_object(node, this.expect_aliases);
	}

	/** Responsibilities: _Jest exception assertions identification_. **/
	public exception_assertion(node: ts.CallExpression): boolean {
		return this.exception_matchers.has(this.matcher_access.member_name(node.expression));
	}
}
