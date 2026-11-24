import type { JestSuite } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { JestSuiteCollectorContract } from "src/testing_protocols";
import type { JestInlineAssertionObjectLiteralsContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _assertion operand analysis_, _object literal ownership_. **/
export class JestInlineAssertionObjectLiterals implements JestInlineAssertionObjectLiteralsContract {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _rule: DiagnosticRuleContract;
	private readonly _alias_declarations: Map<string, ts.VariableDeclaration>;
	private readonly _reference_counts: Map<string, number>;

	/** Responsibilities: _temporary object declarations_. **/
	private object_literal_aliases(suite_body: ts.Block): Map<string, ts.VariableDeclaration> {
		const aliases = new Map<string, ts.VariableDeclaration>();
		for (const statement of suite_body.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) {
					continue;
				}
				const initializer = declaration.initializer;
				if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
					aliases.set(declaration.name.text, declaration);
				}
			}
		}
		return aliases;
	}

	/** Responsibilities: _temporary alias reference names_. **/
	private reference_name(node: ts.Node): string {
		if (!ts.isIdentifier(node) || !this._alias_declarations.has(node.text)) {
			return "";
		}
		if (this.is_declaration_name(node)) {
			return "";
		}
		return node.text;
	}

	/** Responsibilities: _non-reference identifier locations_. **/
	private is_declaration_name(node: ts.Identifier): boolean {
		const parent = node.parent;
		if (ts.isVariableDeclaration(parent) && parent.name === node) {
			return true;
		}
		if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
			return true;
		}
		if (ts.isPropertyAssignment(parent) && parent.name === node) {
			return true;
		}
		if (ts.isMethodDeclaration(parent) && parent.name === node) {
			return true;
		}
		if (ts.isPropertyDeclaration(parent) && parent.name === node) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _temporary alias reference counts_. **/
	private reference_counts(reference_scope: ts.Block): Map<string, number> {
		const counts = new Map<string, number>();
		const visit = (node: ts.Node): void => {
			const name = this.reference_name(node);
			if (name.length > 0) {
				counts.set(name, (counts.get(name) ?? 0) + 1);
			}
			ts.forEachChild(node, visit);
		};
		visit(reference_scope);
		return counts;
	}

	/** Responsibilities: _Jest equality operands_. **/
	private equality_operands(call: ts.CallExpression): ReadonlyMap<string, ts.Identifier> {
		const operands = new Map<string, ts.Identifier>();
		if (!ts.isPropertyAccessExpression(call.expression)) {
			return operands;
		}
		const matcher = call.expression.name.text;
		if (matcher !== "toEqual" && matcher !== "toStrictEqual") {
			return operands;
		}
		const expectation = call.expression.expression;
		if (!ts.isCallExpression(expectation)) {
			return operands;
		}
		this.append_equality_arguments(call, expectation, operands);
		return operands;
	}

	/** Responsibilities: _Jest equality assertion operands_. **/
	private append_equality_arguments(
		call: ts.CallExpression,
		expectation: ts.CallExpression,
		operands: Map<string, ts.Identifier>,
	): void {
		const expect_name = expectation.expression;
		if (!ts.isIdentifier(expect_name)) {
			return;
		}
		if (!this._expect_aliases.receiver({ expression: expect_name, node: call })) {
			return;
		}
		this.append_equality_identifiers(operands, expectation.arguments, call.arguments);
	}

	/** Responsibilities: _Jest equality identifier pairs_. **/
	private append_equality_identifiers(
		operands: Map<string, ts.Identifier>,
		actual_arguments: ts.NodeArray<ts.Expression>,
		expected_arguments: ts.NodeArray<ts.Expression>,
	): void {
		const actual = actual_arguments[0];
		const expected = expected_arguments[0];
		if (actual === undefined || expected === undefined) {
			return;
		}
		if (!ts.isIdentifier(actual) || !ts.isIdentifier(expected)) {
			return;
		}
		operands.set(actual.text, actual);
		operands.set(expected.text, expected);
	}

	/** Responsibilities: _temporary operands before assertion_. **/
	private has_temporary_operand(operands: ReadonlyMap<string, ts.Identifier>, assertion_start: number): boolean {
		for (const name of operands.keys()) {
			const declaration = this._alias_declarations.get(name);
			if (declaration === undefined) {
				continue;
			}
			const declared_before = declaration.getStart(this._source_file) < assertion_start;
			const used_only_here = this._reference_counts.get(name) === 1;
			if (declared_before && used_only_here) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _first invalid equality line_. **/
	private invalid_assertion_line(assertion_scope: ts.Block): number {
		let line = 0;
		const visit = (node: ts.Node): void => {
			if (line > 0) {
				return;
			}
			if (ts.isCallExpression(node)) {
				const operands = this.equality_operands(node);
				const assertion_start = node.getStart(this._source_file);
				if (this.has_temporary_operand(operands, assertion_start)) {
					line = this._source_file.getLineAndCharacterOfPosition(assertion_start).line + 1;
					return;
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(assertion_scope);
		return line;
	}

	/** Responsibilities: _diagnostic initialization_. **/
	public constructor(
		file: string,
		source_file: ts.SourceFile,
		suite_collector: JestSuiteCollectorContract,
		expect_aliases: TypeScriptExpressionAliasesContract,
	) {
		this._file = file;
		this._source_file = source_file;
		this._suite_collector = suite_collector;
		this._expect_aliases = expect_aliases;
		this._rule = new DiagnosticRule("inline-assertion-object-literals");
		this._alias_declarations = new Map();
		this._reference_counts = new Map();
	}

	/** Responsibilities: _suite assertion diagnostics_. **/
	public append_suite(suite: JestSuite): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const test of suite.tests) {
			violations.push(...this.append(test));
		}
		return violations;
	}

	/** Responsibilities: _single test assertion diagnostics_. **/
	public append(test: ts.CallExpression): ViolationContract[] {
		const violations: ViolationContract[] = [];
		this._suite_collector.with_callback(test, (callback) => {
			if (callback.body === undefined || !ts.isBlock(callback.body)) {
				return;
			}
			this._alias_declarations.clear();
			for (const [name, declaration] of this.object_literal_aliases(callback.body)) {
				this._alias_declarations.set(name, declaration);
			}
			if (this._alias_declarations.size === 0) {
				return;
			}
			this._reference_counts.clear();
			for (const [name, count] of this.reference_counts(callback.body)) {
				this._reference_counts.set(name, count);
			}
			const line = this.invalid_assertion_line(callback.body);
			if (line > 0) {
				violations.push(this._rule.violation(this._file, line, {}));
			}
		});
		return violations;
	}
}
