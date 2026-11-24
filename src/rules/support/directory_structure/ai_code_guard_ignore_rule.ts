import { join } from "node:path";
import { AI_CODE_GUARD_DIRECTORY, GITIGNORE_PROBE_NAME } from "src/constants";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { GitIgnoredPathsContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _ignore configuration discovery_, _ignored source path filtering_. **/
export class AiCodeGuardIgnoreRule {
	private readonly _rule: RuleContract;
	private readonly _git_ignored_paths: Map<string, GitIgnoredPathsContract>;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _root Git-ignore matcher access_. **/
	private git_ignore(ignore_root: string): GitIgnoredPathsContract {
		const existing = this._git_ignored_paths.get(ignore_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new GitIgnoredPaths(ignore_root, this._source_io);
		this._git_ignored_paths.set(ignore_root, created);
		return created;
	}

	/** Responsibilities: _state-directory rule initialization_. **/
	public constructor(source_io: ProjectSourceIOContract) {
		this._rule = new DiagnosticRule("ai-code-guard-directory-ignored");
		this._git_ignored_paths = new Map<string, GitIgnoredPathsContract>();
		this._source_io = source_io;
	}

	/** Responsibilities: _state-directory ignore state_. **/
	public ignored(state_root: string): boolean {
		const state_directory = join(state_root, AI_CODE_GUARD_DIRECTORY);
		const probe = join(state_directory, GITIGNORE_PROBE_NAME);
		const visible_probe = this.git_ignore(state_root).filter([probe]);
		if (visible_probe.length > 0) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _ignore policy violation collection_. **/
	public append(violations: ViolationContract[], report_root: string): void {
		if (this.ignored(report_root)) {
			return;
		}
		violations.push(this._rule.violation(AI_CODE_GUARD_DIRECTORY, 1, {}));
	}
}
