import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review hook write policy", () => {
	test("accepts an absolute finding path for the active stage", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stage");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		io.directory_operations.create_directory(fixture.review_root());
		const finding = join(fixture.review_root(), "review-boundaries-worker-failure-cleanup.md");

		expect(
			application.decision(
				fixture.payload(root, "Write", { ...HOOK_TOOL_CONTEXT, command: "", file_path: finding, path: "", patch: "" }),
			).allowed,
		).toBe(true);
	});

	test("rejects symlink writes and patches but allows regular finding files", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-write-symlink");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const directory = fixture.review_root();
		io.directory_operations.create_directory(directory);
		const linked_finding = join(directory, "review-boundaries-linked.md");
		io.file_content.write_text(join(root, "source.ts"), "export const value = 1;\n");
		io.create_symbolic_link(linked_finding, join(root, "source.ts"));
		const input = { ...HOOK_TOOL_CONTEXT, command: "", file_path: linked_finding, path: "", patch: "" };
		const linked_file = application.decision(fixture.payload(root, "Write", input)).allowed;
		const ordinary_file = application.decision(
			fixture.payload(root, "Write", { ...input, file_path: join(directory, "review-boundaries-ordinary.md") }),
		).allowed;
		const linked_patch = application.decision(
			fixture.payload(root, "apply_patch", {
				...input,
				file_path: "",
				patch: `*** Begin Patch\n*** Update File: ${linked_finding}\n*** End Patch`,
			}),
		).allowed;

		expect({ linked_file, ordinary_file, linked_patch }).toEqual({
			linked_file: false,
			ordinary_file: true,
			linked_patch: false,
		});
	});

	test("rejects a symlinked review directory", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-directory-symlink");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		const directory = fixture.review_root();
		const outside = join(root, "outside-review");
		io.directory_operations.create_directory(directory);
		io.directory_operations.create_directory(outside);
		io.remove_directory(directory);
		io.create_symbolic_link(directory, outside);
		const allowed = application.decision(
			fixture.payload(root, "Write", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: join(directory, "review-boundaries.md"),
				path: "",
				patch: "",
			}),
		).allowed;

		expect(allowed).toBe(false);
	});

	test("denies writes without the active review prefix", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-missing-prefix");
		fixture.initialize(new Map());
		const { root, io } = fixture;
		const application = new AgentHookApplication(io);
		io.directory_operations.create_directory(fixture.review_root());
		const decision = application.decision({
			...fixture.payload(root, "Write", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: ".ai-code-guard/review/review-boundaries-finding.md",
				path: "",
				patch: "",
			}),
			review_prefix: "",
		});

		expect(decision.allowed).toBe(false);
	});
});
