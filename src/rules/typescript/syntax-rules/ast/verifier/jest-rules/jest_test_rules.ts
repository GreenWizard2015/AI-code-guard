import { JEST_DESCRIBE_NAME, TEST_PATH_SUFFIXES } from "src/constants";
import type { JestSuite } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { TypeScriptExpressionAliases } from "src/parser/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ViolationContract } from "src/reporting_protocols";
import { JestInlineAssertionObjectLiterals } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_inline_assertion_object_literals";
import { JestTestTypeChecks } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/assertions/jest_test_type_checks";
import { JestExecutionDependencyRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/async/jest_execution_dependency_rules";
import { JestSuiteCollector } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_suite_collector";
import { JestTestProductionUsage } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_production_usage";
import { JestTestSuitePolicy } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_suite_policy";
import type { LintStageTimerContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import type { JestBindingIndexContract, JestTestRulesContract } from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _Jest production usage_, _suite policy_. **/
export class JestTestRules implements JestTestRulesContract {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _suite_collector: JestSuiteCollector;
	private readonly _suites: JestSuite[];
	private readonly _suite_policy: JestTestSuitePolicy;
	private readonly _execution_dependency_rules: JestExecutionDependencyRules;
	private readonly _test_type_checks: JestTestTypeChecks;
	private readonly _expect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _fixture complexity_, _production behavior validation_. **/
	private production_usage_violations(resolver: TypeScriptModuleResolverContract): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const production_usage = new JestTestProductionUsage(
			this._suite_collector,
			this._test_path_syntax,
			this._file,
			this._source_file,
			resolver,
		);
		this._stage_timer.measure("rule.test-production-usage.typescript", () =>
			production_usage.append(
				violations,
				this._suites.flatMap((suite) => suite.tests),
			),
		);
		return violations;
	}

	/** Responsibilities: _Jest test composition_. **/
	public constructor(
		file: string,
		source_file: ts.SourceFile,
		bindings: JestBindingIndexContract,
		stage_timer: LintStageTimerContract,
	) {
		this._file = file;
		this._stage_timer = stage_timer;
		this._source_file = source_file;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		this._expect_aliases = new TypeScriptExpressionAliases("expect", declaration_index);
		this._suite_collector = new JestSuiteCollector(
			new TypeScriptExpressionAliases(JEST_DESCRIBE_NAME, declaration_index),
			new TypeScriptExpressionAliases("test", declaration_index),
			new TypeScriptExpressionAliases("it", declaration_index),
		);
		this._suites = this._suite_collector.suites(source_file);
		this._test_type_checks = new JestTestTypeChecks(file, source_file, this._suite_collector, this._expect_aliases);
		const suite_tests = this._suites.flatMap((suite) => suite.tests);
		this._execution_dependency_rules = new JestExecutionDependencyRules(
			file,
			source_file,
			this._suite_collector,
			suite_tests,
			bindings,
		);
		this._suite_policy = new JestTestSuitePolicy({
			file,
			source_file,
			suite_collector: this._suite_collector,
			expect_aliases: this._expect_aliases,
			suites: this._suites,
			inline_objects: new JestInlineAssertionObjectLiterals(
				file,
				source_file,
				this._suite_collector,
				this._expect_aliases,
			),
			bindings,
			stage_timer,
		});
	}

	/** Responsibilities: _aggregation Jest violations source_. **/
	public append_violations(violations: ViolationContract[], resolver: TypeScriptModuleResolverContract): void {
		violations.push(...this.production_usage_violations(resolver));
		this._suite_policy.append_violations(this._suites, violations);
		violations.push(...this._execution_dependency_rules.time_dependency_violations());
		violations.push(...this._execution_dependency_rules.order_dependency_violations());
		for (const suite of this._suites) {
			for (const test of suite.tests) {
				violations.push(...this._test_type_checks.append(test));
			}
		}
	}
}
