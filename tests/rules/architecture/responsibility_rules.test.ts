import { describe, expect, test } from "@jest/globals";
import type { ResponsibilityWordingCheckerContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { AstResponsibilityTarget } from "src/model/ast/normalized_ast_types";
import { ResponsibilityRules } from "src/rules/architecture/responsibility_rules";

describe("Responsibilities wording rules", () => {
	test("delegates wording validation to the injected checker", () => {
		let checked_values: readonly string[] = [];
		const checker: ResponsibilityWordingCheckerContract = {
			valid(values): boolean {
				checked_values = values;
				return false;
			},
		};
		const rules = new ResponsibilityRules(checker);
		const target: AstResponsibilityTarget = {
			kind: "function",
			name: "run",
			line: 0,
			documentation: "/** Responsibilities: _owned work_. **/",
		};

		const violations = rules.collect("service.ts", [target]);
		const target_violations = rules.collect_target("service.ts", target);

		expect({
			checked_values,
			violations: violations.map((violation) => violation.rule_id()),
			target_violations: target_violations.map((violation) => violation.rule_id()),
		}).toEqual({
			checked_values: ["owned work"],
			violations: ["responsibilities-wording"],
			target_violations: ["responsibilities-wording"],
		});
	});

	test("accepts wording when the injected checker approves it", () => {
		const checker: ResponsibilityWordingCheckerContract = {
			valid: () => true,
		};
		const rules = new ResponsibilityRules(checker);
		const target: AstResponsibilityTarget = {
			kind: "function",
			name: "run",
			line: 0,
			documentation: "/** Responsibilities: _owned work_. **/",
		};

		expect(rules.collect("service.ts", [target])).toHaveLength(0);
	});

	test("requires two named responsibilities for class contracts", () => {
		const rules = new ResponsibilityRules({ valid: (): boolean => true });
		const target: AstResponsibilityTarget = {
			kind: "class",
			name: "AccountSession",
			line: 0,
			documentation: "/** Responsibilities: _account lifecycle_. **/",
		};

		const violations = rules.collect("account_session.ts", [target]);

		expect(violations.map((violation) => violation.rule_id())).toEqual(["responsibilities-min-count"]);
	});

	test("accepts one cohesive responsibility for interface contracts", () => {
		const rules = new ResponsibilityRules({ valid: (): boolean => true });
		const target: AstResponsibilityTarget = {
			kind: "interface",
			name: "MessageReaderContract",
			line: 0,
			documentation: "/** Responsibilities: _message reading contract_. **/",
		};

		expect(rules.collect("message_reader.ts", [target])).toHaveLength(0);
	});

	test("accepts one cohesive responsibility for field records", () => {
		const rules = new ResponsibilityRules({ valid: (): boolean => true });
		const target: AstResponsibilityTarget = {
			kind: "record",
			name: "MessageOptions",
			line: 0,
			documentation: "/** Responsibilities: _message construction options_. **/",
		};

		expect(rules.collect("message_options.py", [target])).toHaveLength(0);
	});
});
