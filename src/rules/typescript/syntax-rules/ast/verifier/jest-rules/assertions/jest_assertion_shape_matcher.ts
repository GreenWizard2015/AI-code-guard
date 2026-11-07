import { JEST_EXCEPTIONS } from "src/constants";
import { JestMatcherAccess } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_matcher_access";
import { JestObjectShapeMatcher } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_object_shape_matcher";
import { JestPropertyAssertionMatcher } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_property_assertion_matcher";
import { JestTypeAssertionMatcher } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_type_assertion_matcher";
import type { JestAssertionMatcherContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _Jest shape assertions matching_, _Jest exception assertions matching_. **/
export class JestAssertionShapeMatcher implements JestAssertionMatcherContract {
	private readonly _type_assertion: JestTypeAssertionMatcher;
	private readonly _property_assertion: JestPropertyAssertionMatcher;
	private readonly _object_shape: JestObjectShapeMatcher;
	private readonly _matcher_access: JestMatcherAccess;
	private readonly _exception_matchers: ReadonlySet<string>;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _Jest shape assertions identification_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(expect_aliases: TypeScriptExpressionAliasesContract) {
		this._exception_matchers = JEST_EXCEPTIONS;
		this._matcher_access = new JestMatcherAccess();
		this._type_assertion = new JestTypeAssertionMatcher(this._matcher_access);
		this._property_assertion = new JestPropertyAssertionMatcher(this._matcher_access);
		this._object_shape = new JestObjectShapeMatcher(this._matcher_access, expect_aliases);
		this._expect_aliases = expect_aliases;
	}
	/** Responsibilities: _public operation_. **/
	public shape_assertion(node: ts.CallExpression): boolean {
		if (this._type_assertion.matches(node, this._expect_aliases)) {
			return true;
		}
		if (this._property_assertion.matches(node, this._expect_aliases)) {
			return true;
		}
		return this._object_shape.shape_object(node);
	}

	/** Responsibilities: _Jest exception assertions identification_. **/
	public exception_assertion(node: ts.CallExpression): boolean {
		return this._exception_matchers.has(this._matcher_access.member_name(node.expression));
	}
}
