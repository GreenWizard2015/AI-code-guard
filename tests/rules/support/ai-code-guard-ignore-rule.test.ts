import { AiCodeGuardIgnoreRule } from "src/rules/support/ai_code_guard_ignore_rule";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { ViolationContract } from "src/protocols";
import { join } from "node:path";

describe("AI Code Guard ignore rule", () => {
	const root = "/virtual/directory-project";

	test("reports when the state directory is not ignored by Git", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "node_modules/\n"]]));
		const rule = new AiCodeGuardIgnoreRule(source_io);
		const violations: ViolationContract[] = [];

		rule.append(violations, root);

		expect(violations.map((violation) => violation.rule_id)).toContain("ai-code-guard-directory-ignored");
	});

	test("accepts a Git ignore entry for the state directory", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "/.ai-code-guard/\n"]]));
		const rule = new AiCodeGuardIgnoreRule(source_io);
		const violations: ViolationContract[] = [];

		rule.append(violations, root);

		expect(violations.map((violation) => violation.rule_id)).not.toContain("ai-code-guard-directory-ignored");
	});
});
