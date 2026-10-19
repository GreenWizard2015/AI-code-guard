import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
	PATCH_ADD_FILE_PREFIX,
	PATCH_DELETE_FILE_PREFIX,
	PATCH_MOVE_FILE_PREFIX,
	PATCH_UPDATE_FILE_PREFIX,
} from "src/core/support/task/review-agent/constants";
import type { ReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewDeletionPolicyContract } from "src/core/support/task/review-agent/protocols";
import type { HookDecision, HookToolInput } from "src/model/types/types";

/** Responsibilities: _patch authorization_, _issue deletion authorization_. **/
export class ReviewMutationPolicy {
	private readonly paths: ReviewPathPolicyContract;
	private readonly deletion_policy: ReviewDeletionPolicyContract;

	/** Responsibilities: _patch path extraction_. **/
	private patch_paths(patch: string): string[] {
		const paths: string[] = [];
		for (const line of patch.split("\n")) {
			if (line.startsWith(PATCH_ADD_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_ADD_FILE_PREFIX.length));
			}
			if (line.startsWith(PATCH_UPDATE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_UPDATE_FILE_PREFIX.length));
			}
			if (line.startsWith(PATCH_DELETE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_DELETE_FILE_PREFIX.length));
			}
			if (line.startsWith(PATCH_MOVE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_MOVE_FILE_PREFIX.length));
			}
		}
		return paths;
	}

	/** Responsibilities: _patch deletion authorization_. **/
	private patch_deletions_allowed(patch: string, cwd: string, cleanup: boolean): boolean {
		for (const line of patch.split("\n")) {
			if (line.startsWith(PATCH_MOVE_FILE_PREFIX)) {
				return false;
			}
			if (!line.startsWith(PATCH_DELETE_FILE_PREFIX)) {
				continue;
			}
			const path = line.slice(PATCH_DELETE_FILE_PREFIX.length);
			if (!this.deletion_policy.allows_patch_deletion(path, cwd, cleanup)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _patch paths_. **/
	private open_paths(patch: string, cwd: string): boolean {
		for (const line of patch.split("\n")) {
			if (!line.startsWith(PATCH_UPDATE_FILE_PREFIX) && !line.startsWith(PATCH_DELETE_FILE_PREFIX)) {
				continue;
			}
			if (!this.deletion_policy.open_review_file(line.slice(line.indexOf(": ") + 2), cwd)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _patch path authorization_. **/
	private patch_paths_allowed(patch: string, cwd: string): boolean {
		const paths = this.patch_paths(patch);
		if (paths.length === 0) {
			return false;
		}
		for (const path of paths) {
			if (!this.paths.allows_file(path, cwd)) {
				return false;
			}
		}
		return this.open_paths(patch, cwd);
	}

	/** Responsibilities: _patch validation_. **/
	private allows_patch(patch: string, cwd: string, cleanup: boolean): boolean {
		if (!this.patch_deletions_allowed(patch, cwd, cleanup)) {
			return false;
		}
		return this.patch_paths_allowed(patch, cwd);
	}

	/** Responsibilities: _mutation denial wording_. **/
	private mutation_denial_reason(cleanup: boolean): string {
		if (cleanup) {
			return "Cleanup patches may delete only existing open Markdown findings in .ai-code-guard/review/.";
		}
		return "Patches may change only open Markdown findings in .ai-code-guard/review/. Split oversized findings before removing the original.";
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(paths: ReviewPathPolicyContract, deletion_policy: ReviewDeletionPolicyContract) {
		this.paths = paths;
		this.deletion_policy = deletion_policy;
	}

	/** Responsibilities: _review-file mutations_. **/
	public write_decision(file_path: string, fallback_path: string, cwd: string): HookDecision {
		let path = file_path;
		if (path.length === 0) {
			path = fallback_path;
		}
		if (!this.paths.allows_file(path, cwd)) {
			return { allowed: false, reason: "Review writes must stay in .ai-code-guard/review/." };
		}
		if (!existsSync(resolve(cwd, path))) {
			return { allowed: true, reason: "" };
		}
		if (this.deletion_policy.allows_write(path, cwd)) {
			return { allowed: true, reason: "" };
		}
		return { allowed: false, reason: "Only open review findings may be changed." };
	}

	/** Responsibilities: _patch authorization_. **/
	public patch_decision(input: HookToolInput, cwd: string, cleanup: boolean): HookDecision {
		let patch = input.patch;
		if (typeof patch !== "string" || patch.length === 0) {
			patch = input.command;
		}
		if (this.allows_patch(patch, cwd, cleanup)) {
			return { allowed: true, reason: "" };
		}
		return {
			allowed: false,
			reason: this.mutation_denial_reason(cleanup),
		};
	}

}
