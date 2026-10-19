import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review hook file operations", () => {
	test("denies review-agent tools access to archived review files", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-resolved-access");
		fixture.initialize(new Map());
		const resolved_root = join(fixture.root, ".ai-code-guard", "resolved-review");
		fixture.io.directory_operations.create_directory(resolved_root);
		const resolved_file = join(resolved_root, "finding.md");
		fixture.io.file_content.write_text(resolved_file, "Status: Resolved\n");
		const application = new AgentHookApplication(fixture.io);
		const read_file = application.decision(
			fixture.payload(fixture.root, "Read", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: resolved_file,
				path: "",
				patch: "",
			}),
		);
		const recursive_glob = application.decision(
			fixture.payload(fixture.root, "Glob", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: fixture.root,
				path: "",
				patch: "",
			}),
		);

		expect({ read_file: read_file.allowed, recursive_glob: recursive_glob.allowed }).toEqual({
			read_file: false,
			recursive_glob: false,
		});
	});

	test("allows cleanup of an open finding but protects resolved findings", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-deletion");
		fixture.initialize(
			new Map([
				["review-boundaries-open.md", "# Finding\n"],
				["review-boundaries-resolved.md", "# Finding\nStatus: Resolved\n"],
			]),
		);
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const directory = fixture.review_root();
		const finding = join(directory, "review-boundaries-open.md");
		const resolved = join(directory, "review-boundaries-resolved.md");
		const cleanup_input = { ...HOOK_TOOL_CONTEXT, command: `/bin/rm ${finding}`, file_path: "", path: "", patch: "" };
		const open_cleanup = application.decision({
			...fixture.payload(root, "Bash", cleanup_input),
			review_phase: "cleanup",
		}).allowed;
		const resolved_cleanup = application.decision({
			...fixture.payload(root, "Bash", { ...cleanup_input, command: `/bin/rm ${resolved}` }),
			review_phase: "cleanup",
		}).allowed;

		expect({ open_cleanup, resolved_cleanup }).toEqual({ open_cleanup: true, resolved_cleanup: false });
	});

	test("does not apply cleanup-only size limits during the initial review", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-oversized-cleanup");
		fixture.initialize(
			new Map([["review-boundaries-large.md", Array.from({ length: 31 }, () => "finding").join("\n")]]),
		);
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const large_finding = join(fixture.review_root(), "review-boundaries-large.md");
		const allowed = application.decision({
			...fixture.payload(root, "Bash", {
				...HOOK_TOOL_CONTEXT,
				command: `/bin/rm ${large_finding}`,
				file_path: "",
				path: "",
				patch: "",
			}),
			review_phase: "initial",
		}).allowed;

		expect(allowed).toBe(true);
	});

	test("rejects project-local shell executables during cleanup", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-local-rm");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const finding = join(fixture.review_root(), "review-boundaries-open.md");
		io.directory_operations.create_directory(fixture.review_root());
		io.file_content.write_text(finding, "# Finding\n");
		const untrusted_command = application.decision(
			fixture.payload(root, "Bash", {
				...HOOK_TOOL_CONTEXT,
				command: `${join(root, "tools", "rm")} ${finding}`,
				file_path: "",
				path: "",
				patch: "",
			}),
		).allowed;

		expect(untrusted_command).toBe(false);
	});

	test("reports progress after an oversized finding is written", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-oversized-progress");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const directory = fixture.review_root();
		io.directory_operations.create_directory(directory);
		io.file_content.write_text(join(directory, "review-boundaries-open.md"), "# Finding\n");
		io.file_content.write_text(join(directory, "review-boundaries-second.md"), "# Second\n");
		io.file_content.write_text(join(directory, "review-boundaries-resolved.md"), "# Finding\nStatus: Resolved\n");
		const oversized = join(directory, "review-boundaries-oversized.md");
		io.file_content.write_text(oversized, Array.from({ length: 31 }, () => "finding").join("\n"));
		io.file_content.write_text(join(directory, "review-complete.md"), "complete\n");
		const response = application.response(
			{
				...fixture.payload(root, "Write", {
					...HOOK_TOOL_CONTEXT,
					command: "",
					file_path: oversized,
					path: "",
					patch: "",
				}),
				event: "PostToolUse",
				hook_event_name: "PostToolUse",
			},
			{ allowed: true, reason: "" },
		);

		expect({
			progress: response.includes("Defects remaining to find: 6."),
			guidance: response.includes("Split it in the review directory"),
			algorithm_review: response.includes("algorithmic complexity"),
			abstraction_review: response.includes("domain objects"),
		}).toEqual({ progress: true, guidance: true, algorithm_review: true, abstraction_review: true });
	});

	test("clamps remaining finding progress at zero", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-progress");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const directory = fixture.review_root();
		io.directory_operations.create_directory(directory);
		for (let index = 0; index < 11; index += 1) {
			io.file_content.write_text(join(directory, `review-boundaries-finding-${index}.md`), "# Finding\n");
		}
		const response = application.response(
			{
				...fixture.payload(root, "Write", {
					...HOOK_TOOL_CONTEXT,
					command: "",
					file_path: "not-a-review-file",
					path: "",
					patch: "",
				}),
				event: "PostToolUse",
				hook_event_name: "PostToolUse",
			},
			{ allowed: true, reason: "" },
		);

		expect(response).toContain("Defects remaining to find: 0.");
	});
});
