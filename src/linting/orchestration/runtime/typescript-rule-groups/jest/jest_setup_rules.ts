import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { MAX_FUNCTION_LINES } from "src/constants";
import type { JestSetupRulesContract, JestSuiteCollectorContract, ViolationContract } from "src/protocols";
import type { JestTestSizeContract } from "src/protocols";
import { TypeScriptExpressionIdentity } from "src/model/type_script_expression_identity";

/** Responsibilities: _duplicate setup detection_, _fixture complexity analysis_. **/
export class JestSetupRules implements JestSetupRulesContract {
	private readonly suite_collector: JestSuiteCollectorContract;
	private readonly test_size: JestTestSizeContract;
	private readonly duplicate_setup_rule: DiagnosticRule;
	private readonly fixture_complexity_rule: DiagnosticRule;
	private readonly fixture_hook_names: ReadonlySet<string>;
	private readonly expression_identity: TypeScriptExpressionIdentity;

	/** Responsibilities: _assertion statement_. **/
	private assertion_statement(statement: ts.Statement, source_file: ts.SourceFile): boolean {
		if (!ts.isExpressionStatement(statement)) {
			return false;
		}
		const text = statement.expression.getText(source_file).replace(/\s+/gu, "");
		return text.startsWith("expect(") || text.startsWith("awaitexpect(");
	}

	/** Responsibilities: _duplicate setup pair_. **/
	private duplicate_pair(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		previous: ts.Statement,
		current: ts.Statement,
	): boolean {
		if (!this.expression_identity.equal(previous, current)) {
			return false;
		}
		violations.push(this.duplicate_setup_rule.violation(
			file,
			source_file.getLineAndCharacterOfPosition(current.getStart(source_file)).line + 1,
		));
		return true;
	}

	/** Responsibilities: _duplicate setup statements_. **/
	private append_duplicate_statements(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		statements: readonly ts.Statement[],
	): void {
		for (let index = 1; index < statements.length; index += 1) {
			const previous = statements[index - 1];
			const current = statements[index];
			if (previous === undefined || current === undefined) {
				continue;
			}
			if (this.assertion_statement(previous, source_file)) {
				break;
			}
			if (this.assertion_statement(current, source_file)) {
				break;
			}
			if (this.duplicate_pair(violations, file, source_file, previous, current)) {
				break;
			}
		}
	}

	/** Responsibilities: _duplicate setup callback_. **/
	private append_duplicate_callback(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		callback: ts.FunctionLikeDeclaration,
	): void {
		if (callback.body === undefined) {
			return;
		}
		if (!ts.isBlock(callback.body)) {
			return;
		}
		this.append_duplicate_statements(violations, file, source_file, callback.body.statements);
	}

	/** Responsibilities: _fixture hook name_. **/
	private fixture_hook_name(node: ts.CallExpression): string {
		if (ts.isIdentifier(node.expression)) {
			return node.expression.text;
		}
		if (ts.isPropertyAccessExpression(node.expression)) {
			return node.expression.name.text;
		}
		return "";
	}

	/** Responsibilities: _fixture callback diagnostic_. **/
	private append_fixture_callback(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.CallExpression,
	): void {
		this.suite_collector.with_callback(node, (callback) => {
			if (callback.body === undefined) {
				return;
			}
			if (!ts.isBlock(callback.body)) {
				return;
			}
			const size = this.test_size.body(source_file, [callback.body]);
			if (size <= MAX_FUNCTION_LINES) {
				return;
			}
			const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
			violations.push(this.fixture_complexity_rule.violation(file, line));
		});
	}

	/** Responsibilities: _setup rule initialization_. **/
	public constructor(suite_collector: JestSuiteCollectorContract, test_size: JestTestSizeContract) {
		this.suite_collector = suite_collector;
		this.test_size = test_size;
		this.duplicate_setup_rule = new DiagnosticRule("test-duplicate-setup");
		this.fixture_complexity_rule = new DiagnosticRule("fixture-complexity");
		this.fixture_hook_names = new Set(["beforeEach", "afterEach", "beforeAll", "afterAll"]);
		this.expression_identity = new TypeScriptExpressionIdentity();
	}

	/** Responsibilities: _duplicate setup diagnostics_. **/
	public append_duplicate_setup(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void {
		for (const test of tests) {
			this.suite_collector.with_callback(test, (callback) =>
				this.append_duplicate_callback(violations, file, source_file, callback),
			);
		}
	}

	/** Responsibilities: _fixture complexity diagnostics_. **/
	public append_fixture_complexity(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
	): void {
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				const hook_name = this.fixture_hook_name(node);
				if (this.fixture_hook_names.has(hook_name)) {
					this.append_fixture_callback(violations, file, source_file, node);
				}
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}
}
