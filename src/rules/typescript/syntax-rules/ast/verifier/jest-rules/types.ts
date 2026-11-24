import type { JestSuite } from "src/model/ast/normalized_ast_types";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type {
	JestBindingIndexContract,
	JestInlineAssertionObjectLiteralsContract,
	JestSuiteCollectorContract,
} from "src/testing_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

export type JestRulePair = {
	first: DiagnosticRuleContract;
	second: DiagnosticRuleContract;
};

export type JestTestSuitePolicyOptions = {
	file: string;
	source_file: ts.SourceFile;
	suite_collector: JestSuiteCollectorContract;
	expect_aliases: TypeScriptExpressionAliasesContract;
	suites: JestSuite[];
	inline_objects: JestInlineAssertionObjectLiteralsContract;
	bindings: JestBindingIndexContract;
	stage_timer: LintStageTimerContract;
};
