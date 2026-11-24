import { resolve } from "node:path";
import { LintInputFileDiscovery } from "src/core/discovery/lint_input_file_discovery";
import type { LintInputFiles } from "src/project_analysis_types";
import type { TextFileDiscoveryContract } from "src/runtime_protocols";
import type { LintInputFileSelectorContract, ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _input request normalization_, _file discovery delegation_. **/
export class LintInputFileSelector implements LintInputFileSelectorContract {
	private readonly _text_files: TextFileDiscoveryContract;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _file discovery dependencies initialization_. **/
	public constructor(text_files: TextFileDiscoveryContract, source_io: ProjectSourceIOContract) {
		this._text_files = text_files;
		this._source_io = source_io;
	}

	/** Responsibilities: _ignored directory normalization_. **/
	public ignored_directories(repo_root: string, configured: readonly string[]): ReadonlySet<string> {
		const paths: string[] = [];
		for (const value of configured) {
			const trimmed = value.trim();
			if (trimmed.length > 0) {
				paths.push(resolve(repo_root, trimmed).replaceAll("\\", "/"));
			}
		}
		return new Set(paths);
	}

	/** Responsibilities: _complete-cache input collection_. **/
	public input_files(
		repo_root: string,
		configured: readonly string[],
		explicit_files: readonly string[] = [],
	): LintInputFiles {
		const discovery = new LintInputFileDiscovery({
			repo_root,
			explicit_files,
			ignored_directories: this.ignored_directories(repo_root, configured),
			text_files: this._text_files,
			source_io: this._source_io,
		});
		return discovery.input_files(discovery.candidate_state());
	}
}
