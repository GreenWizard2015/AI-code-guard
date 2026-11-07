import { describe, expect, test } from "@jest/globals";
import { TestRunnerArguments } from "test-runner/test_runner_arguments";

describe("test runner request arguments", () => {
	test("does not select an architecture-review agent by default", () => {
		const arguments_parser = new TestRunnerArguments(["--headless"]);
		const request = arguments_parser.request();

		expect({ review_agent: request.review_agent, force_review: request.force_review }).toEqual({
			review_agent: "none",
			force_review: false,
		});
	});

	test("parses an explicitly selected provider", () => {
		const arguments_parser = new TestRunnerArguments(["--force-review", "--review-agent", "claude"]);
		const request = arguments_parser.request();

		expect(request.review_agent).toBe("claude");
	});

	test("keeps the first provider when duplicate provider options are present", () => {
		const arguments_parser = new TestRunnerArguments(["--review-agent", "codex", "--review-agent", "claude"]);
		const request = arguments_parser.request();

		expect(request.review_agent).toBe("codex");
	});
});
