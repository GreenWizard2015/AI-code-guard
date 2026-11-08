import { describe, expect, test } from "@jest/globals";
import { ReviewAgentHookCommand } from "src/core/support/task/review-agent/review_agent_hook_command";

describe("review hook argument serialization", () => {
	test("serializes the review prefix and infinite start-time cutoff", () => {
		const command = new ReviewAgentHookCommand(
			"/tools/tsx",
			"/project/agent-hooks.ts",
			"review-boundaries-",
			Number.POSITIVE_INFINITY,
		);

		expect(command.arguments()).toEqual([
			"/tools/tsx",
			"/project/agent-hooks.ts",
			"--review-prefix",
			"review-boundaries-",
			"--review-started-at",
			"Infinity",
		]);
	});

	test("preserves each configured argument and quotes the complete path", () => {
		const command = new ReviewAgentHookCommand(
			"/tools/tsx",
			"/project/path with $HOME/agent's-hooks.ts",
			"review-$(touch injected)-",
			1700000000000,
		);

		expect({ arguments: command.arguments(), command: command.command() }).toEqual({
			arguments: [
				"/tools/tsx",
				"/project/path with $HOME/agent's-hooks.ts",
				"--review-prefix",
				"review-$(touch injected)-",
				"--review-started-at",
				"1700000000000",
			],
			command:
				"'/tools/tsx' '/project/path with $HOME/agent'\"'\"'s-hooks.ts' '--review-prefix' 'review-$(touch injected)-' '--review-started-at' '1700000000000'",
		});
	});
});
