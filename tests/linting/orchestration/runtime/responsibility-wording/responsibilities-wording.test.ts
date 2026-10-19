import { describe, expect, test } from "@jest/globals";
import type { AstResponsibilityTarget } from "src/types";
import { ResponsibilityRules } from "src/linting/orchestration/runtime/responsibility-wording/responsibility_rules";
import type { ResponsibilityWordingCheckerContract } from "src/linting/orchestration/runtime/protocols";
import { ResponsibilityWording } from "src/linting/orchestration/runtime/responsibility-wording/responsibility_wording";

describe("Responsibilities wording rule", () => {
	test("checks every word while separating noun forms", () => {
		const checker = new ResponsibilityWording(new Set(["validate", "processing"]), new Set(), new Set(["processing"]));

		expect(checker.valid(["user validate"])).toBe(false);
		expect(checker.valid(["data processing"])).toBe(true);
	});

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

		expect(checked_values).toEqual(["owned work"]);
		expect(violations).toEqual([expect.objectContaining({ rule_id: "responsibilities-wording" })]);
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
		const rules = new ResponsibilityRules({ valid: () => true });
		const target: AstResponsibilityTarget = {
			kind: "class",
			name: "AccountSession",
			line: 0,
			documentation: "/** Responsibilities: _account lifecycle_. **/",
		};

		const violations = rules.collect("account_session.ts", [target]);

		expect(violations.map((violation) => violation.rule_id)).toEqual(["responsibilities-min-count"]);
	});

	test("accepts one cohesive responsibility for interface contracts", () => {
		const rules = new ResponsibilityRules({ valid: () => true });
		const target: AstResponsibilityTarget = {
			kind: "interface",
			name: "MessageReaderContract",
			line: 0,
			documentation: "/** Responsibilities: _message reading contract_. **/",
		};

		expect(rules.collect("message_reader.ts", [target])).toHaveLength(0);
	});

	test("accepts one cohesive responsibility for field records", () => {
		const rules = new ResponsibilityRules({ valid: () => true });
		const target: AstResponsibilityTarget = {
			kind: "record",
			name: "MessageOptions",
			line: 0,
			documentation: "/** Responsibilities: _message construction options_. **/",
		};

		expect(rules.collect("message_options.py", [target])).toHaveLength(0);
	});
});
