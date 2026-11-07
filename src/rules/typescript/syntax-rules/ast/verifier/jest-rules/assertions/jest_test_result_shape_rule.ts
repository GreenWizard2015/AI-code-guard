import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { JestExceptionFlagBindings } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_exception_flag_bindings";
import type {
	JestAssertionAnalysisContract,
	JestExceptionFlagBindingsContract,
	JestTestAssertionContract,
} from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _exception flag analysis_, _result assertion validation_. **/
export class JestTestResultShapeRule implements JestTestAssertionContract {
	private readonly _assertion_shape_rule: JestAssertionAnalysisContract;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _try-catch detection_. **/
	private contains_try_catch(body: ts.Block): boolean {
		let found = false;
		const visit = (child: ts.Node): void => {
			if (found) {
				return;
			}
			if (!ts.isTryStatement(child)) {
				ts.forEachChild(child, visit);
				return;
			}
			if (child.catchClause !== undefined) {
				found = true;
				return;
			}
			ts.forEachChild(child, visit);
		};
		visit(body);
		return found;
	}

	/** Responsibilities: _exception flag assertion lookup_. **/
	private asserts_exception_flag(
		assertion: ts.CallExpression,
		flags: ReadonlySet<ts.Node>,
		bindings: JestExceptionFlagBindingsContract,
	): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (bindings.assertion_matches(node, flags)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(assertion);
		return found;
	}

	/** Responsibilities: _catch ancestry classification_. **/
	private inside_catch(node: ts.Node): boolean {
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			if (ts.isCatchClause(current)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _observable assertion classification_. **/
	private observable_assertion(
		assertion: ts.CallExpression,
		flags: ReadonlySet<ts.Node>,
		bindings: JestExceptionFlagBindingsContract,
	): boolean {
		if (this._assertion_shape_rule.exception_only([assertion])) {
			return false;
		}
		if (this.inside_catch(assertion)) {
			return false;
		}
		return !this.asserts_exception_flag(assertion, flags, bindings);
	}

	/** Responsibilities: _observable assertion detection_. **/
	private has_observable_assertion(test: ts.CallExpression, assertions: ts.CallExpression[]): boolean {
		const callback = test.arguments.at(-1);
		if (callback === undefined) {
			return false;
		}
		if (!ts.isArrowFunction(callback)) {
			return false;
		}
		if (!ts.isBlock(callback.body)) {
			return false;
		}
		const bindings = new JestExceptionFlagBindings(callback.getSourceFile(), this._expect_aliases);
		bindings.index_declarations();
		const exception_flags = bindings.exception_flags(callback);
		return assertions.some((assertion) => this.observable_assertion(assertion, exception_flags, bindings));
	}

	/** Responsibilities: _test try-catch classification_. **/
	private has_try_catch(test: ts.CallExpression): boolean {
		const callback = test.arguments.at(-1);
		if (callback === undefined) {
			return false;
		}
		if (!ts.isArrowFunction(callback)) {
			return false;
		}
		if (!ts.isBlock(callback.body)) {
			return false;
		}
		return this.contains_try_catch(callback.body);
	}

	/** Responsibilities: _source line conversion_. **/
	private line(node: ts.CallExpression): number {
		const source_file = node.getSourceFile();
		const position = node.getStart(source_file);
		const location = source_file.getLineAndCharacterOfPosition(position);
		return location.line + 1;
	}

	/** Responsibilities: _Jest result-shape dependency initialization_. **/
	public constructor(assertion_shape_rule: JestAssertionAnalysisContract) {
		this._assertion_shape_rule = assertion_shape_rule;
		this._expect_aliases = new TypeScriptExpressionAliases("expect", new TypeScriptObjectAliasDeclarationIndex());
	}

	/** Responsibilities: _type-only test identification_. **/
	public shape_test_lines(tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const assertions = this._assertion_shape_rule.collect_assertions(test);
			if (this._assertion_shape_rule.shape_only(assertions)) {
				lines.push(this.line(test));
			}
		}
		return lines;
	}

	/** Responsibilities: _exception-only test identification_. **/
	public exception_test_lines(tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const assertions = this._assertion_shape_rule.collect_assertions(test);
			if (this._assertion_shape_rule.exception_only(assertions)) {
				lines.push(this.line(test));
				continue;
			}
			if (this.has_try_catch(test) && !this.has_observable_assertion(test, assertions)) {
				lines.push(this.line(test));
			}
		}
		return lines;
	}
}
