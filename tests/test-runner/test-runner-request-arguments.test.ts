import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { TestRunnerRequestArguments } from "test-runner/test_runner_request_arguments";

describe("test runner request arguments", () => {
	test("does not select an architecture-review agent by default", () => {
		const parser = new TestRunnerRequestArguments(["--headless"]);
		const request = parser.request();

		expect({ review_agent: request.review_agent, force_review: request.force_review }).toEqual({
			review_agent: "none",
			force_review: false,
		});
	});

	test("parses an explicitly selected provider", () => {
		const parser = new TestRunnerRequestArguments(["--force-review", "--review-agent", "claude"]);
		const request = parser.request();

		expect(request.review_agent).toBe("claude");
	});

	test("keeps the first provider when duplicate provider options are present", () => {
		const parser = new TestRunnerRequestArguments(["--review-agent", "codex", "--review-agent", "claude"]);
		const request = parser.request();

		expect(request.review_agent).toBe("codex");
	});
});
