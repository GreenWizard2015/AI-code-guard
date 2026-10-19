import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { JestExceptionFlagBindings } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/assertions/jest_exception_flag_bindings";
import type {
	JestAssertionAnalysisContract,
	JestExceptionFlagBindingsContract,
	JestTestAssertionContract,
} from "src/protocols";
import ts from "typescript";

/** Responsibilities: _exception flag analysis_, _result assertion validation_. **/
export class JestTestResultShapeRule implements JestTestAssertionContract {
	private readonly assertion_shape_rule: JestAssertionAnalysisContract;
	private readonly expect_aliases: TypeScriptExpressionAliases;

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
			if (this.is_flag_assertion(node, flags, bindings)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(assertion);
		return found;
	}

	/** Responsibilities: _exception flag assertion classification_. **/
	private is_flag_assertion(
		node: ts.Node,
		flags: ReadonlySet<ts.Node>,
		bindings: JestExceptionFlagBindingsContract,
	): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		if (!this.expect_aliases.receiver(node.expression, node)) {
			return false;
		}
		const value = node.arguments.at(0);
		if (value === undefined) {
			return false;
		}
		if (!ts.isIdentifier(value)) {
			return false;
		}
		return bindings.exception_flag(value, flags);
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
		if (this.assertion_shape_rule.exception_only([assertion])) {
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
		const bindings = new JestExceptionFlagBindings(callback.getSourceFile());
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
	private line(source_file: ts.SourceFile, node: ts.CallExpression): number {
		const position = node.getStart(source_file);
		const location = source_file.getLineAndCharacterOfPosition(position);
		return location.line + 1;
	}

	/** Responsibilities: _Jest result-shape dependency initialization_. **/
	public constructor(assertion_shape_rule: JestAssertionAnalysisContract) {
		this.assertion_shape_rule = assertion_shape_rule;
		this.expect_aliases = new TypeScriptExpressionAliases("expect");
	}

	/** Responsibilities: _type-only test identification_. **/
	public shape_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const assertions = this.assertion_shape_rule.collect_assertions(test);
			if (this.assertion_shape_rule.shape_only(assertions)) {
				lines.push(this.line(source_file, test));
			}
		}
		return lines;
	}

	/** Responsibilities: _exception-only test identification_. **/
	public exception_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[] {
		const lines: number[] = [];
		for (const test of tests) {
			const assertions = this.assertion_shape_rule.collect_assertions(test);
			if (this.assertion_shape_rule.exception_only(assertions)) {
				lines.push(this.line(source_file, test));
				continue;
			}
			if (this.has_try_catch(test)) {
				if (!this.has_observable_assertion(test, assertions)) {
					lines.push(this.line(source_file, test));
				}
			}
		}
		return lines;
	}
}
