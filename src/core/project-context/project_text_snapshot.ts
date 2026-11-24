import { resolve } from "node:path";
import { PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import { ProjectRuntimeSourcePaths } from "src/core/project-source/project_runtime_source_paths";
import type { ProjectTextSnapshotOptions } from "src/core/types";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";

/** Responsibilities: _complete project text snapshot_, _runtime source path discovery_. **/
export class ProjectTextSnapshot {
	private readonly _options: ProjectTextSnapshotOptions;
	private readonly _complete_texts: Map<string, string>;
	private readonly _runtime_source_paths: ProjectRuntimeSourcePaths;

	/** Responsibilities: _project configuration text completion_. **/
	private append_configuration_texts(): void {
		if (this._options.configuration_snapshot_complete) {
			return;
		}
		const { repo_root, source_io } = this._options;
		const resolution = new TypeScriptProjectResolution(repo_root, source_io);
		const configuration_files = [
			...resolution.configuration_files(),
			resolve(repo_root, PYTHON_PROJECT_CONFIGURATION_FILE),
		];
		for (const file of configuration_files) {
			if (this._complete_texts.has(file) || !source_io.source_available(file)) {
				continue;
			}
			this._complete_texts.set(file, source_io.source_text(file));
		}
	}

	/** Responsibilities: _project source text completion_. **/
	private append_project_texts(): void {
		const { files, provided_texts, virtual_project, source_io } = this._options;
		for (const file of files) {
			if (this._complete_texts.has(file)) {
				continue;
			}
			if (virtual_project && provided_texts.size > 0) {
				throw new Error(`Virtual source snapshot is incomplete: ${file}`);
			}
			this._complete_texts.set(file, source_io.source_text(file));
		}
	}

	/** Responsibilities: _Git-ignore configuration snapshot_. **/
	private append_ignore_texts(): void {
		const { ignore_files, source_io } = this._options;
		for (const file of ignore_files) {
			if (this._complete_texts.has(file) || !source_io.source_available(file)) {
				continue;
			}
			this._complete_texts.set(file, source_io.source_text(file));
		}
	}

	/** Responsibilities: _runtime source text completion_. **/
	private append_runtime_texts(): void {
		const { source_io } = this._options;
		for (const path of this.runtime_paths(this._complete_texts)) {
			this._complete_texts.set(path, source_io.source_text(path));
		}
	}

	/** Responsibilities: _project snapshot initialization_. **/
	public constructor(options: ProjectTextSnapshotOptions) {
		this._options = options;
		this._complete_texts = new Map(options.provided_texts);
		this._runtime_source_paths = new ProjectRuntimeSourcePaths(options.repo_root, options.source_io);
	}

	/** Responsibilities: _runtime source path discovery_. **/
	public runtime_paths(complete_texts: ReadonlyMap<string, string>): string[] {
		if (this._options.virtual_project) {
			return [];
		}
		const paths = new Set<string>();
		this._runtime_source_paths.append_to(paths, new Set(complete_texts.keys()));
		return [...paths];
	}

	/** Responsibilities: _complete source text snapshot_. **/
	public project_texts(): Map<string, string> {
		const { stage_timer } = this._options;
		return stage_timer.measure("startup.project-context.read-files", () => {
			this.append_ignore_texts();
			this.append_configuration_texts();
			this.append_project_texts();
			this.append_runtime_texts();
			return new Map(this._complete_texts);
		});
	}
}
