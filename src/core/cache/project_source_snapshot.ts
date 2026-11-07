import { resolve } from "node:path";
import { PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import { ProjectRuntimeSourcePaths } from "src/core/project-source/project_runtime_source_paths";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ProjectSourceIOContract, ProjectSourceSnapshotContract } from "src/source_protocols";

/** Responsibilities: _project source snapshot preparation_, _source text collection_. **/
export class ProjectSourceSnapshot implements ProjectSourceSnapshotContract {
	private readonly _repo_root: string;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _runtime_source_paths: ProjectRuntimeSourcePaths;

	/** Responsibilities: _input source path collection_. **/
	private append_input_paths(
		source_paths: Set<string>,
		project_files: readonly string[],
		markdown_files: readonly string[],
		ignore_files: readonly string[],
	): void {
		for (const file of project_files) {
			source_paths.add(file);
		}
		for (const file of markdown_files) {
			source_paths.add(file);
		}
		for (const file of ignore_files) {
			if (this._source_io.source_available(file)) {
				source_paths.add(file);
			}
		}
		this._runtime_source_paths.append_to(source_paths, source_paths);
	}

	/** Responsibilities: _project configuration source paths_. **/
	private append_configuration_paths(paths: Set<string>): void {
		const resolution = new TypeScriptProjectResolution(this._repo_root, this._source_io);
		for (const file of resolution.configuration_files()) {
			if (this._source_io.source_available(file)) {
				paths.add(file);
			}
		}
		const python_configuration = resolve(this._repo_root, PYTHON_PROJECT_CONFIGURATION_FILE);
		if (this._source_io.source_available(python_configuration)) {
			paths.add(python_configuration);
		}
	}

	/** Responsibilities: _snapshot IOContract ownership_. **/
	public constructor(repo_root: string, source_io: ProjectSourceIOContract) {
		this._repo_root = resolve(repo_root);
		this._source_io = source_io;
		this._runtime_source_paths = new ProjectRuntimeSourcePaths(this._repo_root, source_io);
	}

	/** Responsibilities: _unique source path collection_. **/
	public source_paths(inputs: LintInputFiles): readonly string[] {
		const paths = new Set<string>();
		this.append_input_paths(paths, inputs.project_files, inputs.markdown_files, inputs.ignore_files);
		this.append_configuration_paths(paths);
		return [...paths];
	}

	/** Responsibilities: _source text snapshot creation_. **/
	public source_texts(inputs: LintInputFiles): ReadonlyMap<string, string> {
		const texts = new Map<string, string>();
		for (const file of this.source_paths(inputs)) {
			if (!this._source_io.source_available(file)) {
				throw new Error(`Project source is missing from the input snapshot: ${file}`);
			}
			texts.set(file, this._source_io.source_text(file));
		}
		return texts;
	}
}
