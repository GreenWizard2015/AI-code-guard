import { basename, join, resolve } from "node:path";
import { MAX_REVIEW_LINES } from "src/constants";
import {
	AI_CODE_GUARD_DIRECTORY,
	APPLY_PATCH_TOOL_NAME,
	HOOK_AGENT_START,
	HOOK_STOP,
	PATCH_ADD_FILE_PREFIX,
	PATCH_UPDATE_FILE_PREFIX,
	REVIEW_COMPLETION_FILE,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
} from "src/core/support/task/review-agent/constants";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import type { ReviewStopSequenceContract } from "src/core/support/task/review-agent/protocols";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";
import { ReviewStopSequence } from "src/core/support/task/review-agent/review_stop_sequence";
import type {
	HookReviewProgressContext,
	HookReviewWriteContext,
	ReviewStopContext,
} from "src/core/support/task/review-agent/types";
import type { IOContract } from "src/io/protocols";
import type { FileEntry } from "src/io/protocols";
import type { ReviewAgentPhase } from "src/task_review_types";

/** Responsibilities: _Markdown document_, _document status_. **/
export class ReviewFindingVerifier {
	private readonly _io: IOContract;

	/** Responsibilities: _document size limits_. **/
	private size_feedback(text: string): string {
		const document = new ReviewFindingDocument(text);
		const lines = document.line_count();
		if (lines <= MAX_REVIEW_LINES) {
			return "";
		}
		return [
			`The review file has ${lines} lines and exceeds the ${MAX_REVIEW_LINES}-line limit.`,
			`Split it in the review directory into focused review files of at most ${MAX_REVIEW_LINES} lines.`,
			"Keep every confirmed finding, then mark the original oversized file Status: Resolved.",
		].join(" ");
	}

	/** Responsibilities: _document field schema_. **/
	private format_feedback(text: string): string {
		const document = new ReviewFindingDocument(text);
		const missing = document.missing_fields();
		if (missing.length === 0) {
			return "";
		}
		return `Missing required fields: ${missing.join(", ")}. Add each field with specific content and use exactly one valid review status.`;
	}

	/** Responsibilities: _file feedback text_. **/
	private file_feedback(file: string): string {
		const text = this._io.file(file).file_text();
		const messages = [this.size_feedback(text), this.format_feedback(text)].filter((message) => message.length > 0);
		return messages.map((message) => `${file}: ${message}`).join("\n\n");
	}

	/** Responsibilities: _document issue details_. **/
	private format_problems(files: readonly string[]): string[] {
		const problems: string[] = [];
		for (const file of files) {
			const text = this._io.file(file).file_text();
			const document = new ReviewFindingDocument(text);
			const missing = document.missing_fields();
			if (missing.length > 0) {
				problems.push(`${file}: missing ${missing.join(", ")}.`);
			}
		}
		return problems;
	}

	/** Responsibilities: _invalid inventory_. **/
	private invalid_findings_feedback(files: readonly string[]): string {
		const problems = this.format_problems(files);
		if (problems.length === 0) {
			return "";
		}
		const messages = ["Fix every review-format problem before stopping. Required fields:", ...problems];
		return messages.join("\n");
	}

	/** Responsibilities: _patch file paths_. **/
	private patch_paths(patch: string): string[] {
		const paths: string[] = [];
		for (const line of patch.split("\n")) {
			if (line.startsWith(PATCH_ADD_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_ADD_FILE_PREFIX.length).trim());
			}
			if (line.startsWith(PATCH_UPDATE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_UPDATE_FILE_PREFIX.length).trim());
			}
		}
		return paths;
	}

	/** Responsibilities: _tool input paths_. **/
	private write_paths(request: HookReviewWriteContext): string[] {
		if (request.tool_name !== APPLY_PATCH_TOOL_NAME) {
			return [request.file_path || request.path];
		}
		return this.patch_paths(request.patch || request.command);
	}

	/** Responsibilities: _changed file feedback_. **/
	private changed_file_feedback(candidate_path: string, project_directory: string): string {
		const absolute_file = resolve(project_directory, candidate_path);
		const path_policy = new ReviewPathPolicy(this._io, project_directory);
		const allowed_path = path_policy.allows_file(candidate_path);
		if (!allowed_path) {
			return "";
		}
		if (!this._io.file(absolute_file).path_exists()) {
			return "";
		}
		return this.file_feedback(absolute_file);
	}

	/** Responsibilities: _review file type_. **/
	private is_finding(entry: FileEntry, prefix: string): boolean {
		if (!entry.is_file || !entry.name.endsWith(".md")) {
			return false;
		}
		if (entry.name === REVIEW_COMPLETION_FILE || entry.name === REVIEW_FAILURE_FILE) {
			return false;
		}
		return entry.name.startsWith(prefix);
	}

	/** Responsibilities: _continuation and finding-format feedback_. **/
	private stop_feedback(
		sequence: ReviewStopSequenceContract,
		phase: ReviewAgentPhase,
		scope: HookReviewProgressContext,
	): string {
		const continuation = sequence.feedback();
		if (continuation.length > 0) {
			return continuation;
		}
		if (phase !== "initial" || scope.review_prefix.length === 0) {
			return "";
		}
		const files = this.paths(scope.cwd, scope.review_prefix, scope.review_start_ms);
		return this.invalid_findings_feedback(files);
	}

	/** Responsibilities: _verifier initialization_. **/
	public constructor(io: IOContract) {
		this._io = io;
	}

	/** Responsibilities: _agent review lifecycle feedback_. **/
	public review_feedback(context: ReviewStopContext): string {
		if (context.event === HOOK_AGENT_START) {
			const start_sequence = new ReviewStopSequence(this._io, context);
			start_sequence.begin();
			return "";
		}
		if (context.event !== HOOK_STOP) {
			return "";
		}
		const stop_sequence = new ReviewStopSequence(this._io, context);
		return this.stop_feedback(stop_sequence, context.phase, {
			cwd: context.cwd,
			review_prefix: context.review_prefix,
			review_start_ms: context.review_start_ms,
		});
	}

	/** Responsibilities: _stage file paths_. **/
	public paths(root: string, prefix: string, review_start_ms: number): string[] {
		const review_root = join(root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		if (!this._io.file(review_root).path_exists()) {
			return [];
		}
		return this._io
			.list_entries(review_root)
			.filter((entry) => this.is_finding(entry, prefix))
			.filter((entry) => {
				const file = this._io.file(join(review_root, entry.name));
				return file.metadata().mtime_ms > review_start_ms;
			})
			.map((entry) => join(review_root, entry.name));
	}

	/** Responsibilities: _post-write guidance_. **/
	public write_feedback(request: HookReviewWriteContext): string {
		const feedback: string[] = [];
		for (const candidate_path of this.write_paths(request)) {
			const absolute_file = resolve(request.cwd, candidate_path);
			if (!basename(absolute_file).startsWith(request.review_prefix)) {
				continue;
			}
			const message = this.changed_file_feedback(candidate_path, request.cwd);
			if (message.length > 0) {
				feedback.push(message);
			}
		}
		return feedback.join("\n\n");
	}
}
