import { join } from "node:path";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { ViolationContract } from "src/reporting_protocols";
import { AiCodeGuardIgnoreRule } from "src/rules/support/ai_code_guard_ignore_rule";

describe("AI Code Guard ignore rule", () => {
	const root = "/virtual/directory-project";

	test("reports when the state directory is not ignored by Git", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "node_modules/\n"]]));
		const rule = new AiCodeGuardIgnoreRule(source_io);
		const violations: ViolationContract[] = [];

		rule.append(violations, root);

		expect(violations.map((violation) => violation.rule_id())).toContain("ai-code-guard-directory-ignored");
	});

	test("accepts anchored and unanchored Git ignore entries for the state directory", () => {
		const results: boolean[] = [];
		for (const pattern of ["/.ai-code-guard/", ".ai-code-guard"]) {
			const source_io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), `${pattern}\n`]]));
			const rule = new AiCodeGuardIgnoreRule(source_io);
			const violations: ViolationContract[] = [];

			rule.append(violations, root);
			results.push(violations.some((violation) => violation.rule_id() === "ai-code-guard-directory-ignored"));
		}

		expect(results).toEqual([false, false]);
	});
});
