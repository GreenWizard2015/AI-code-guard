import {
	JEST_AFTER_ALL_NAME,
	JEST_AFTER_EACH_NAME,
	JEST_BEFORE_ALL_NAME,
	JEST_BEFORE_EACH_NAME,
	MAX_FUNCTION_LINES,
} from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptExpressionIdentity } from "src/model/type_script_expression_identity";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { JestSetupRulesContract, JestSuiteCollectorContract } from "src/testing_protocols";
import type { JestTestSizeContract } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _duplicate setup detection_, _fixture complexity analysis_. **/
export class JestSetupRules implements JestSetupRulesContract {
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _test_size: JestTestSizeContract;
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _duplicate_setup_rule: RuleContract;
	private readonly _fixture_complexity_rule: RuleContract;
	private readonly _fixture_hook_names: ReadonlySet<string>;
	private readonly _expression_identity: TypeScriptExpressionIdentity;

	/** Responsibilities: _assertion statement_. **/
	private assertion_statement(statement: ts.Statement): boolean {
		if (!ts.isExpressionStatement(statement)) {
			return false;
		}
		const text = statement.expression.getText(this._source_file).replace(/\s+/gu, "");
		return text.startsWith("expect(") || text.startsWith("awaitexpect(");
	}

	/** Responsibilities: _duplicate setup pair_. **/
	private duplicate_pair(previous: ts.Statement, current: ts.Statement): ViolationContract[] {
		if (!this._expression_identity.equal(previous, current)) {
			return [];
		}
		return [
			this._duplicate_setup_rule.violation(
				this._file,
				this._source_file.getLineAndCharacterOfPosition(current.getStart(this._source_file)).line + 1,
				{},
			),
		];
	}

	/** Responsibilities: _duplicate setup statements_. **/
	private duplicate_statements(statements: readonly ts.Statement[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		statements.slice(1).some((current, index) => {
			const previous = statements[index];
			if (previous === undefined || current === undefined) {
				return false;
			}
			if (this.assertion_statement(previous) || this.assertion_statement(current)) {
				return true;
			}
			const pair_violations = this.duplicate_pair(previous, current);
			violations.push(...pair_violations);
			return pair_violations.length > 0;
		});
		return violations;
	}

	/** Responsibilities: _duplicate setup callback_. **/
	private duplicate_callback(callback: ts.FunctionLikeDeclaration): ViolationContract[] {
		if (callback.body === undefined) {
			return [];
		}
		if (!ts.isBlock(callback.body)) {
			return [];
		}
		return this.duplicate_statements(callback.body.statements);
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
	private fixture_callback(node: ts.CallExpression): ViolationContract[] {
		const violations: ViolationContract[] = [];
		this._suite_collector.with_callback(node, (callback) => {
			if (callback.body === undefined) {
				return;
			}
			if (!ts.isBlock(callback.body)) {
				return;
			}
			const size = this._test_size.body([callback.body]);
			if (size <= MAX_FUNCTION_LINES) {
				return;
			}
			const line = this._source_file.getLineAndCharacterOfPosition(node.getStart(this._source_file)).line + 1;
			violations.push(this._fixture_complexity_rule.violation(this._file, line, {}));
		});
		return violations;
	}

	/** Responsibilities: _setup rule initialization_. **/
	public constructor(
		suite_collector: JestSuiteCollectorContract,
		test_size: JestTestSizeContract,
		file: string,
		source_file: ts.SourceFile,
	) {
		this._suite_collector = suite_collector;
		this._test_size = test_size;
		this._file = file;
		this._source_file = source_file;
		this._duplicate_setup_rule = new DiagnosticRule("test-duplicate-setup");
		this._fixture_complexity_rule = new DiagnosticRule("fixture-complexity");
		this._fixture_hook_names = new Set([
			JEST_BEFORE_EACH_NAME,
			JEST_AFTER_EACH_NAME,
			JEST_BEFORE_ALL_NAME,
			JEST_AFTER_ALL_NAME,
		]);
		this._expression_identity = new TypeScriptExpressionIdentity();
	}

	/** Responsibilities: _duplicate setup diagnostics_. **/
	public append_duplicate_setup(tests: ts.CallExpression[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const test of tests) {
			this._suite_collector.with_callback(test, (callback) => violations.push(...this.duplicate_callback(callback)));
		}
		return violations;
	}

	/** Responsibilities: _fixture complexity diagnostics_. **/
	public fixture_complexity(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				const hook_name = this.fixture_hook_name(node);
				if (this._fixture_hook_names.has(hook_name)) {
					violations.push(...this.fixture_callback(node));
				}
			}
			node.forEachChild(visit);
		};
		visit(this._source_file);
		return violations;
	}
}
