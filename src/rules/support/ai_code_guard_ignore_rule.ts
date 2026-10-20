import { join } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import type { GitIgnoredPathsContract } from "src/runtime_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { AI_CODE_GUARD_DIRECTORY, GITIGNORE_FILE_NAME, GITIGNORE_PROBE_NAME } from "src/constants";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _ignore configuration discovery_, _ignored source path filtering_. **/
export class AiCodeGuardIgnoreRule {
	private readonly rule: DiagnosticRule;
	private readonly git_ignored_paths: Map<string, GitIgnoredPathsContract>;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _root Git-ignore matcher access_. **/
	private git_ignore(repo_root: string): GitIgnoredPathsContract {
		const existing = this.git_ignored_paths.get(repo_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new GitIgnoredPaths(repo_root, this.source_io);
		this.git_ignored_paths.set(repo_root, created);
		return created;
	}

	/** Responsibilities: _state-directory rule initialization_. **/
	public constructor(source_io: ProjectSourceIOContract) {
		this.rule = new DiagnosticRule("ai-code-guard-directory-ignored");
		this.git_ignored_paths = new Map<string, GitIgnoredPathsContract>();
		this.source_io = source_io;
	}

	/** Responsibilities: _state-directory ignore state_. **/
	public ignored(repo_root: string): boolean {
		const state_directory = join(repo_root, AI_CODE_GUARD_DIRECTORY);
		const probe = join(state_directory, GITIGNORE_PROBE_NAME);
		const visible_probe = this.git_ignore(repo_root).filter([probe]);
		if (visible_probe.length > 0) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _ignore policy violation collection_. **/
	public append(violations: ViolationContract[], repo_root: string): void {
		if (this.ignored(repo_root)) {
			return;
		}
		violations.push(this.rule.violation(GITIGNORE_FILE_NAME, 1));
	}
}
