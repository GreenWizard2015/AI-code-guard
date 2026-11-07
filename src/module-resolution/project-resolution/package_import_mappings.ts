import { dirname, resolve as resolve_path } from "node:path";
import { PACKAGE_MANIFEST_FILE } from "src/constants";
import { PackageImportMappingRun } from "src/module-resolution/project-resolution/package_import_mapping_run";
import type { PackageImportMappingsContract } from "src/module-resolution/protocols";
import type { TypeScriptPathMapping } from "src/module-resolution/types";
import type { ProjectSourceContentIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _package import mapping sources_, _manifest availability_. **/
export class PackageImportMappings implements PackageImportMappingsContract {
	private readonly _source_io: ProjectSourceContentIOContract;
	private readonly _package_file: string;
	private readonly _package_source_files: readonly string[];

	/** Responsibilities: _package manifest dependency_. **/
	public constructor(project_root: string, source_io: ProjectSourceContentIOContract) {
		this._source_io = source_io;
		this._package_file = resolve_path(project_root, PACKAGE_MANIFEST_FILE);
		const available_source_files: string[] = [];
		if (this._source_io.source_available(this._package_file)) {
			available_source_files.push(this._package_file);
		}
		this._package_source_files = Object.freeze(available_source_files);
	}

	/** Responsibilities: _package manifest source paths_. **/
	public source_files(): readonly string[] {
		return this._package_source_files;
	}

	/** Responsibilities: _package manifest import mappings_. **/
	public mappings(conditions: ReadonlySet<string>): readonly TypeScriptPathMapping[] {
		if (this._package_source_files.length === 0) {
			return [];
		}
		const source = ts.parseJsonText(this._package_file, this._source_io.source_text(this._package_file));
		const mapping_run = new PackageImportMappingRun(dirname(this._package_file), conditions);
		mapping_run.append(source);
		return mapping_run.mappings();
	}
}
