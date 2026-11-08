import { join } from "node:path";
import type { HookPayload } from "src/model_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _review hook request data_, _review-stage file layout_. **/
export class ReviewHookFilePolicyFixture {
	public readonly _root: string;
	public readonly _io: InMemoryFileIO;

	/** Responsibilities: _virtual review project initialization_. **/
	public constructor(name: string) {
		this._root = `/virtual/${name}`;
		this._io = new InMemoryFileIO();
	}

	/** Responsibilities: _review project preparation_. **/
	public initialize(findings: ReadonlyMap<string, string>): void {
		this._io.create_directory(this._root);
		const agent_document_directory = join(this._root, "docs", "agent");
		const template = join(agent_document_directory, "on_review.md");
		this._io.create_directory(agent_document_directory);
		this._io
			.file(template)
			.write_text("Defects remaining to find: {N}. Focus on algorithmic complexity and domain objects.");
		this._io.create_directory(join(this._root, ".ai-code-guard"));
		this._io.create_directory(this.review_root());
		for (const [name, text] of findings) {
			this._io.file(join(this.review_root(), name)).write_text(text);
		}
	}

	/** Responsibilities: _review document sample_. **/
	public review_document(): string {
		return [
			"# Example invariant is violated",
			"Severity: Major",
			"Status: Open",
			"",
			"Task: Preserve the source ownership invariant.",
			"",
			"Affected paths:",
			"- `src/example.ts`: `resolve_source`.",
			"",
			"Invariant: A source record keeps the identity of its defining file.",
			"",
			"Evidence:",
			"- The caller replaces the defining file with a same-named import.",
			"",
			"Reproduction: Import two same-named declarations and resolve a call.",
			"",
			"Impact: Usage is attributed to the wrong declaration.",
			"",
			"Required correction:",
			"- Preserve the defining-file identity and assert the resolved target.",
		].join("\n");
	}

	/** Responsibilities: _review hook payload_. **/
	public payload(cwd: string, tool_name: string, tool_input: HookPayload["tool_input"]): HookPayload {
		return {
			event: "PreToolUse",
			hook_event_name: "PreToolUse",
			stop_hook_active: false,
			tool_name,
			tool_input,
			cwd,
			review_stage: "boundaries",
			review_prefix: "review-boundaries-",
			review_start_ms: 0,
		};
	}

	/** Responsibilities: _stage review directory_. **/
	public review_root(): string {
		return join(this._root, ".ai-code-guard", "review");
	}
}
