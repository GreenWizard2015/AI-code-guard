import "src/bridge/ts/core/context-factory";
import { describe, expect, test } from "@jest/globals";
import { TaskReviewCompletionCode } from "src/bridge/ts/core/support/task/task-review-completion-code";

describe("architecture review completion code", () => {
	test("generates a hash and verifies the current code", () => {
		const service = new TaskReviewCompletionCode();
		const current_time = new Date("2026-01-02T03:04:00Z");
		const code = service.completion_code(current_time);

		expect({
			is_hash: /^[0-9a-f]{32}$/u.test(code),
			current_verified: service.contains(`review complete: ${code}`, current_time),
		}).toEqual({ is_hash: true, current_verified: true });
	});

	test("accepts the previous four minutes and rejects older codes", () => {
		const service = new TaskReviewCompletionCode();
		const current_time = new Date("2026-01-02T03:04:00Z");
		const four_minutes = 4 * 60_000;
		const five_minutes = 5 * 60_000;
		const previous_code = service.completion_code(new Date(current_time.getTime() - four_minutes));
		const expired_code = service.completion_code(new Date(current_time.getTime() - five_minutes));

		expect({
			previous_verified: service.contains(`review complete: ${previous_code}`, current_time),
			expired_rejected: service.contains(`review complete: ${expired_code}`, current_time),
		}).toEqual({ previous_verified: true, expired_rejected: false });
	});
});
