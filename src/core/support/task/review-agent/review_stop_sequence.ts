import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	HOOK_STOP,
	REVIEW_STOP_LOG_FILE_NAME,
} from "src/core/support/task/review-agent/constants";
import type { ReviewStopSequenceContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewStopContext } from "src/core/support/task/review-agent/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _agent stop-attempt tracking_, _agent continuation feedback_. **/
export class ReviewStopSequence implements ReviewStopSequenceContract {
	private readonly _io: IOContract;
	private readonly _context: ReviewStopContext;
	private readonly _log_file: string;
	private readonly _attempt_marker: string;
	private readonly _fallback_attempt_count: number;

	/** Responsibilities: _review stage progress_. **/
	private attempt_count(): number {
		const log_file = this._io.file(this._log_file);
		if (!log_file.path_exists()) {
			return this._fallback_attempt_count;
		}
		return this.parse_attempt_lines(log_file.file_text().split("\n"));
	}

	/** Responsibilities: _review attempt marker parsing_. **/
	private parse_attempt_lines(lines: readonly string[]): number {
		for (let index = lines.length - 1; index >= 0; index--) {
			const line = lines[index];
			if (line === undefined || !line.startsWith(this._attempt_marker)) {
				continue;
			}
			const count = Number(line.slice(this._attempt_marker.length));
			if (!Number.isInteger(count)) {
				return this._fallback_attempt_count;
			}
			if (count < 0) {
				return this._fallback_attempt_count;
			}
			return count;
		}
		return this._fallback_attempt_count;
	}

	/** Responsibilities: _review attempt persistence_. **/
	private record_attempt(count: number): void {
		this._io.create_directory(dirname(this._log_file));
		const log_file = this._io.file(this._log_file);
		log_file.append_text(`${this._attempt_marker}${count}\n`);
	}

	/** Responsibilities: _review continuation guidance_. **/
	private continuation_feedback(attempts: number): string {
		if (attempts === 0) {
			return [
				"Do not stop yet. Perform a deeper, systematic review of this stage, even if findings are already recorded:",
				"trace important production behavior through its callers and tests, inspect failure and cleanup paths,",
				"and look for concrete defects, algorithmic costs, missing behavioral coverage, and outdated assumptions.",
				"Record every confirmed material finding; do not invent issues to reach a target.",
			].join(" ");
		}
		return [
			"Do not stop yet. Perform one final, deeper review of this stage, even if findings are already recorded:",
			"revisit the highest-risk production paths, check ownership and state transitions, and challenge assumptions",
			"that the current implementation is correct. Record any confirmed material finding with reproducible evidence;",
			"do not create artificial findings.",
		].join(" ");
	}

	/** Responsibilities: _review attempt state_. **/
	public constructor(io: IOContract, context: ReviewStopContext) {
		this._io = io;
		this._context = context;
		this._log_file = join(context.cwd, AI_CODE_GUARD_DIRECTORY, REVIEW_STOP_LOG_FILE_NAME);
		const identity = createHash("sha256").update(`${context.phase}\n${context.review_prefix}`).digest("hex");
		this._attempt_marker = `[review-stop-attempt] ${identity}=`;
		let fallback_attempt_count = 0;
		if (context.stop_hook_active) {
			fallback_attempt_count = 1;
		}
		this._fallback_attempt_count = fallback_attempt_count;
	}

	/** Responsibilities: _review stage initialization_. **/
	public begin(): void {
		this.record_attempt(0);
	}

	/** Responsibilities: _review stage guidance_. **/
	public feedback(): string {
		if (this._context.event !== HOOK_STOP) {
			return "";
		}
		if (this._context.phase !== "initial") {
			return "";
		}
		if (this._context.review_prefix.length === 0) {
			return "";
		}
		const attempts = this.attempt_count();
		if (attempts >= 2) {
			return "";
		}
		this.record_attempt(attempts + 1);
		return this.continuation_feedback(attempts);
	}
}
