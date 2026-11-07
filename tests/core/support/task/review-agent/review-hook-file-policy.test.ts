import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { HOOK_AGENT_START, HOOK_STOP } from "src/core/support/task/review-agent/constants";
import { ReviewFindingVerifier } from "src/core/support/task/review-agent/review_finding_verifier";
import type { ReviewStopContext } from "src/core/support/task/review-agent/types";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review finding stop validation", () => {
	test("starts the review sequence before returning first-stop guidance", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-start-before-stop");
		fixture.initialize(new Map());
		const verifier = new ReviewFindingVerifier(fixture._io);
		const context: ReviewStopContext = {
			event: HOOK_AGENT_START,
			cwd: fixture._root,
			phase: "initial",
			review_prefix: "review-boundaries-",
			review_start_ms: 0,
			stop_hook_active: false,
		};
		const start_feedback = verifier.review_feedback(context);
		const stop_feedback = verifier.review_feedback({ ...context, event: HOOK_STOP });

		expect({
			start_feedback,
			first_stop_requests_review: stop_feedback.includes("Perform a deeper, systematic review"),
		}).toEqual({
			start_feedback: "",
			first_stop_requests_review: true,
		});
	});

	test("does not validate finding files during the cleanup phase", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-cleanup-stop");
		fixture.initialize(new Map([["review-boundaries-finding.md", "# Incomplete finding\n"]]));
		const verifier = new ReviewFindingVerifier(fixture._io);
		const context: ReviewStopContext = {
			event: HOOK_STOP,
			cwd: fixture._root,
			phase: "cleanup",
			review_prefix: "review-boundaries-",
			review_start_ms: 0,
			stop_hook_active: false,
		};

		expect(verifier.review_feedback(context)).toBe("");
	});

	test("blocks the first stop and requests a deeper review", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stop-empty");
		fixture.initialize(new Map());
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const payload = {
			...fixture.payload(fixture._root, "", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: "",
			}),
			event: "Stop",
			hook_event_name: "Stop",
		};
		const decision = application.decision(payload);
		const response = application.response({ payload, decision });
		const expected_reason = [
			"Do not stop yet. Perform a deeper, systematic review of this stage, even if findings are already recorded:",
			"trace important production behavior through its callers and tests, inspect failure and cleanup paths,",
			"and look for concrete defects, algorithmic costs, missing behavioral coverage, and outdated assumptions.",
			"Record every confirmed material finding; do not invent issues to reach a target.",
		].join(" ");

		expect({ decision, response: JSON.parse(response) }).toEqual({
			decision: {
				allowed: false,
				reason: expected_reason,
			},
			response: { decision: "block", reason: expected_reason },
		});
	});

	test("blocks two empty stops for deeper analysis and allows the third", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stop-three-attempts");
		fixture.initialize(new Map());
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const payload = {
			...fixture.payload(fixture._root, "", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: "",
			}),
			event: "Stop",
			hook_event_name: "Stop",
		};
		const first = application.decision(payload);
		const second = application.decision({ ...payload, stop_hook_active: true });
		const third = application.decision({ ...payload, stop_hook_active: true });

		expect({
			first_blocked: !first.allowed,
			second_blocked: !second.allowed,
			second_requests_deep_analysis: second.reason.includes("one final, deeper review"),
			third_allowed: third.allowed,
		}).toEqual({
			first_blocked: true,
			second_blocked: true,
			second_requests_deep_analysis: true,
			third_allowed: true,
		});
	});

	test("checks every selected-stage review only on the third stop", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stop-with-finding");
		fixture.initialize(new Map([["review-boundaries-finding.md", fixture.review_document()]]));
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const payload = {
			...fixture.payload(fixture._root, "", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: "",
			}),
			event: "Stop",
			hook_event_name: "Stop",
		};

		const first = application.decision(payload);
		const second = application.decision({ ...payload, stop_hook_active: true });
		const third = application.decision({ ...payload, stop_hook_active: true });

		expect({ first: first.allowed, second: second.allowed, third: third.allowed }).toEqual({
			first: false,
			second: false,
			third: true,
		});
	});

	test("keeps blocking Stop while a finding is missing required fields", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stop-invalid-format");
		fixture.initialize(new Map([["review-boundaries-finding.md", "# Incomplete finding\nStatus: Open\n"]]));
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const payload = {
			...fixture.payload(fixture._root, "", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: "",
			}),
			event: "Stop",
			hook_event_name: "Stop",
			stop_hook_active: true,
		};
		application.decision({ ...payload, stop_hook_active: false });
		application.decision({ ...payload, stop_hook_active: true });
		const decision = application.decision({ ...payload, stop_hook_active: true });

		expect({ allowed: decision.allowed, missing_task: decision.reason.includes("Task") }).toEqual({
			allowed: false,
			missing_task: true,
		});
	});

	test("keeps blocking Stop when a required finding section is present but empty", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stop-empty-evidence");
		const finding = fixture
			.review_document()
			.replace("Evidence:\n- The caller replaces the defining file with a same-named import.", "Evidence:\n\n");
		fixture.initialize(new Map([["review-boundaries-finding.md", finding]]));
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const payload = {
			...fixture.payload(fixture._root, "", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: "",
			}),
			event: "Stop",
			hook_event_name: "Stop",
		};
		application.decision(payload);
		application.decision({ ...payload, stop_hook_active: true });
		const decision = application.decision({ ...payload, stop_hook_active: true });

		expect({ allowed: decision.allowed, missing_evidence: decision.reason.includes("Evidence") }).toEqual({
			allowed: false,
			missing_evidence: true,
		});
	});

	test("reports missing review fields after writing a finding", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-post-write-format");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const finding_path = join(fixture.review_root(), "review-boundaries-finding.md");
		_io.file(finding_path).write_text("# Incomplete finding\n");
		const response = application.response({
			payload: {
				...fixture.payload(_root, "Write", {
					...HOOK_TOOL_CONTEXT,
					command: "",
					file_path: finding_path,
					path: "",
					patch: "",
				}),
				event: "PostToolUse",
				hook_event_name: "PostToolUse",
			},
			decision: { allowed: true, reason: "" },
		});

		expect(response).toContain(
			"Missing required fields: Severity (use High, Major, or Medium), Status (use Status: Open or Status: Resolved exactly once), Task",
		);
	});

	test("excludes old findings from progress and blocks edits to them", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-old-finding");
		const old_path = join(fixture.review_root(), "review-boundaries-old.md");
		fixture.initialize(new Map([["review-boundaries-old.md", fixture.review_document()]]));
		const review_start_ms = fixture._io.file(old_path).metadata().mtime_ms;
		const application = new AgentHookApplication(fixture._io, fixture._root);
		const old_write = application.decision({
			...fixture.payload(fixture._root, "Write", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: old_path,
				path: "",
				patch: "",
			}),
			review_start_ms,
		});
		const old_read = application.decision({
			...fixture.payload(fixture._root, "Read", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: old_path,
				path: "",
				patch: "",
			}),
			review_start_ms,
		});
		const current_path = join(fixture.review_root(), "review-boundaries-current.md");
		fixture._io.file(current_path).write_text(fixture.review_document());
		const current_payload = {
			...fixture.payload(fixture._root, "Write", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: current_path,
				path: "",
				patch: "",
			}),
			event: "PostToolUse",
			hook_event_name: "PostToolUse",
			review_start_ms,
		};
		const progress = application.response({ payload: current_payload, decision: { allowed: true, reason: "" } });

		expect({
			old_read_allowed: old_read.allowed,
			old_write_allowed: old_write.allowed,
			one_current_finding: progress.includes("Defects remaining to find: 9"),
		}).toEqual({
			old_read_allowed: true,
			old_write_allowed: false,
			one_current_finding: true,
		});
	});
});
