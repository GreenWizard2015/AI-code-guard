import { join } from "node:path";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { AGENT_DOCUMENT_DIRECTORY, ON_REVIEW_DOCUMENT } from "src/core/support/task/review-agent/constants";
import type { HookPayload } from "src/model_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { HOOK_TOOL_CONTEXT } from "tests/core/constants";

/** Responsibilities: _review fixture data_, _hook request payload_. **/
export class ExternalReviewProgressScenario {
	/** Responsibilities: _review template setup_. **/
	private seed_template(io: InMemoryFileIO, template_path: string): void {
		io.create_directory(join(REPORTING_PROJECT_ROOT, "docs", AGENT_DOCUMENT_DIRECTORY));
		io.file(template_path).write_text("Defects remaining to find: {N}. Continue reviewing.");
	}

	/** Responsibilities: _review document content_. **/
	private seed_finding(io: InMemoryFileIO, finding_path: string): void {
		io.file(finding_path).write_text(
			[
				"# Finding",
				"Severity: Major",
				"Status: Open",
				"Task: Preserve the source identity invariant.",
				"Affected paths:",
				"- `src/example.ts`.",
				"Invariant: Source identity remains attached to its defining file.",
				"Evidence:",
				"- Two declarations can share a name.",
				"- The declarations can originate in different source files.",
				"- Name-only lookup cannot distinguish these declarations.",
				"- Import resolution already knows the defining source path.",
				"- Dropping that path merges distinct symbol identities.",
				"Reproduction: Resolve a reference between same-named declarations.",
				"- Export the same name from two modules.",
				"- Import each export through a different path.",
				"Impact: Usage can be attributed to the wrong declaration.",
				"Required correction:",
				"- Preserve the defining-file identity.",
				"- Carry that identity through every lookup and cache key.",
			].join("\n"),
		);
	}

	/** Responsibilities: _review hook request_. **/
	private write_payload(root: string, finding_path: string): HookPayload {
		return {
			event: "PostToolUse",
			hook_event_name: "PostToolUse",
			stop_hook_active: false,
			tool_name: "Write",
			tool_input: {
				...HOOK_TOOL_CONTEXT,
				command: "",
				file_path: finding_path,
				path: "",
				patch: "",
			},
			cwd: root,
			review_stage: "boundaries",
			review_prefix: "review-boundaries-",
			review_start_ms: 0,
		} as const;
	}

	/** Responsibilities: _external review fixture_. **/
	public setup(): { file_io: InMemoryFileIO; payload: HookPayload; target_template_path: string } {
		const root = "/virtual/external-review-project";
		const review_directory = join(root, ".ai-code-guard", "review");
		const finding_path = join(review_directory, "review-boundaries-finding.md");
		const installed_template = join(REPORTING_PROJECT_ROOT, "docs", AGENT_DOCUMENT_DIRECTORY, ON_REVIEW_DOCUMENT);
		const target_template = join(root, "docs", AGENT_DOCUMENT_DIRECTORY, ON_REVIEW_DOCUMENT);
		const io = new InMemoryFileIO();
		this.seed_template(io, installed_template);
		io.create_directory(root);
		io.create_directory(join(root, ".ai-code-guard"));
		io.create_directory(review_directory);
		this.seed_finding(io, finding_path);
		return {
			file_io: io,
			payload: this.write_payload(root, finding_path),
			target_template_path: target_template,
		};
	}
}
