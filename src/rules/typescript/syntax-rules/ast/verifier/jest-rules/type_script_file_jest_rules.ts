import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TEST_PATH_SUFFIXES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import { JestBindingIndex } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_binding_index";
import { JestTestRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_rules";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _Jest source test rules_, _test module contracts_. **/
export class TypeScriptFileJestRules implements ASTSourceRuleContract {
	/** Responsibilities: _test path eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _Jest test file policy_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		const { context } = request;
		const {
			source: { file, source_file },
			analysis: { module_resolver },
		} = context.state();
		if (!TEST_PATH_SUFFIXES.typescript.some((suffix) => file.endsWith(suffix))) {
			return;
		}
		context.state().analysis.stage_timer.measure("file-analysis.typescript.script-rule.jest", () => {
			const violations: ViolationContract[] = [];
			const jest_rules = new JestTestRules(file, source_file, new JestBindingIndex(source_file));
			jest_rules.append_violations(violations, module_resolver);
			for (const violation of violations) {
				context.append_violation(violation);
			}
		});
	}
}
