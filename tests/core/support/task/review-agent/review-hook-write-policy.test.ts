import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { AgentHookApplication } from "src/core/support/task/review-agent/agent_hook_application";
import { ExternalReviewProgressScenario } from "tests/bridge/ts/core/support/task/review-agent/external_review_progress_scenario";
import { ReviewHookFilePolicyFixture } from "tests/bridge/ts/core/support/task/review-agent/review-hook-file-policy-fixture";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

describe("review hook write policy", () => {
	test("accepts an absolute finding path for the active stage", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-stage");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		_io.create_directory(fixture.review_root());
		const finding = join(fixture.review_root(), "review-boundaries-worker-failure-cleanup.md");

		expect(
			application.decision(
				fixture.payload(_root, "Write", { ...HOOK_TOOL_CONTEXT, command: "", file_path: finding, path: "", patch: "" }),
			).allowed,
		).toBe(true);
	});

	test("allows an external finding without installing a local template", () => {
		const scenario = new ExternalReviewProgressScenario();
		const setup = scenario.setup();
		const { file_io, payload, target_template_path } = setup;
		const application = new AgentHookApplication(file_io, REPORTING_PROJECT_ROOT);
		const decision = application.decision(payload);

		expect({
			allowed: decision.allowed,
			target_template_exists: file_io.file(target_template_path).path_exists(),
		}).toEqual({
			allowed: true,
			target_template_exists: false,
		});
	});

	test("renders installed review progress for an external project", () => {
		const scenario = new ExternalReviewProgressScenario();
		const setup = scenario.setup();
		const { file_io, payload } = setup;
		const application = new AgentHookApplication(file_io, REPORTING_PROJECT_ROOT);
		const decision = application.decision(payload);
		const response = application.response({ payload, decision });
		const expected_response =
			'{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Defects remaining to find: 9. ' +
			'Continue reviewing."}}';

		expect(response).toBe(expected_response);
	});

	test("rejects an Add File patch that targets an existing resolved finding", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-add-resolved-finding");
		fixture.initialize(new Map([["review-boundaries-resolved.md", "# Finding\nStatus: Resolved\n"]]));
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const resolved_finding = join(fixture.review_root(), "review-boundaries-resolved.md");
		const decision = application.decision(
			fixture.payload(_root, "apply_patch", {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: "",
				path: "",
				patch: `*** Begin Patch\n*** Add File: ${resolved_finding}\n+# Replacement\n*** End Patch`,
			}),
		);

		expect(decision.allowed).toBe(false);
	});

	test("rejects symlink writes and patches but allows regular finding files", () => {
		const fixture = new ReviewHookFilePolicyFixture("review-hook-write-symlink");
		fixture.initialize(new Map());
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const directory = fixture.review_root();
		_io.create_directory(directory);
		const linked_finding = join(directory, "review-boundaries-linked.md");
		_io.file(join(_root, "source.ts")).write_text("export const value = 1;\n");
		_io.create_symbolic_link(linked_finding, join(_root, "source.ts"));
		const input = { ...HOOK_TOOL_CONTEXT, command: "", file_path: linked_finding, path: "", patch: "" };
		const linked_file = application.decision(fixture.payload(_root, "Write", input)).allowed;
		const ordinary_file = application.decision(
			fixture.payload(_root, "Write", { ...input, file_path: join(directory, "review-boundaries-ordinary.md") }),
		).allowed;
		const linked_patch = application.decision(
			fixture.payload(_root, "apply_patch", {
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
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		const directory = fixture.review_root();
		const outside = join(_root, "outside-review");
		_io.create_directory(directory);
		_io.create_directory(outside);
		_io.remove_directory(directory);
		_io.create_symbolic_link(directory, outside);
		const allowed = application.decision(
			fixture.payload(_root, "Write", {
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
		const { _root, _io } = fixture;
		const application = new AgentHookApplication(_io, _root);
		_io.create_directory(fixture.review_root());
		const decision = application.decision({
			...fixture.payload(_root, "Write", {
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
