import { join } from "node:path";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import type { HookPayload } from "src/model/types/types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _review hook request data_, _review-stage file layout_. **/
export class ReviewHookFilePolicyFixture {
	public readonly root: string;
	public readonly io: InMemoryFileIO;

	/** Responsibilities: _virtual review project initialization_. **/
	public constructor(name: string) {
		this.root = `/virtual/${name}`;
		this.io = new InMemoryFileIO();
	}

	/** Responsibilities: _review project preparation_. **/
	public initialize(findings: ReadonlyMap<string, string>): void {
		this.io.directory_operations.create_directory(this.root);
		const template = join(REPORTING_PROJECT_ROOT, "docs", "agent", "on_review.md");
		this.io.directory_operations.create_directory(join(REPORTING_PROJECT_ROOT, "docs", "agent"));
		this.io.file_content.write_text(
			template,
			"Defects remaining to find: {N}. Focus on algorithmic complexity and domain objects.",
		);
		this.io.directory_operations.create_directory(join(this.root, ".ai-code-guard"));
		this.io.directory_operations.create_directory(this.review_root());
		for (const [name, text] of findings) {
			this.io.file_content.write_text(join(this.review_root(), name), text);
		}
	}

	/** Responsibilities: _review hook payload_. **/
	public payload(cwd: string, tool_name: string, tool_input: HookPayload["tool_input"]): HookPayload {
		return {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			tool_name,
			tool_input,
			cwd,
			review_stage: "boundaries",
			review_prefix: "review-boundaries-",
			review_phase: "initial",
		};
	}

	/** Responsibilities: _stage review directory_. **/
	public review_root(): string {
		return join(this.root, ".ai-code-guard", "review");
	}
}
