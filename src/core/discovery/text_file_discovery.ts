import { TextFileProject } from "src/core/discovery/text_file_project";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import type { TextFileDiscoveryContract, TextFileProjectContract } from "src/runtime_protocols";
import type { GitIgnoredPathsContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _text file project contexts_, _Git ignore cache ownership_. **/
export class TextFileDiscovery implements TextFileDiscoveryContract {
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _git_ignored_paths: Map<string, GitIgnoredPathsContract>;

	/** Responsibilities: _Git ignore path filtering_. **/
	private git_filter(repo_root: string): GitIgnoredPathsContract {
		const existing = this._git_ignored_paths.get(repo_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new GitIgnoredPaths(repo_root, this._source_io);
		this._git_ignored_paths.set(repo_root, created);
		return created;
	}

	/** Responsibilities: _text discovery policy initialization_. **/
	public constructor(source_io: ProjectSourceIOContract) {
		this._git_ignored_paths = new Map<string, GitIgnoredPathsContract>();
		this._source_io = source_io;
	}

	/** Responsibilities: _project-scoped text file discovery_. **/
	public for_project(repo_root: string, configured_ignored: ReadonlySet<string>): TextFileProjectContract {
		return new TextFileProject({
			repo_root,
			configured_ignored,
			source_io: this._source_io,
			git_ignored_paths: this.git_filter(repo_root),
		});
	}
}
