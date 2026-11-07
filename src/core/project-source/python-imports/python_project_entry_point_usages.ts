import { relative, resolve } from "node:path";
import type { ReadonlyStringSetMap, StringSetMap } from "src/analysis_types";
import { PYTHON_PACKAGE_MARKER, PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _Python entry-point resolution_, _exported symbol collection_. **/
export class PythonProjectEntryPointUsages {
	private readonly _root: string;
	private readonly _files: ReadonlySet<string>;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _usages: StringSetMap;

	/** Responsibilities: _TOML section extraction_. **/
	private section_name(section_header: string): string {
		const section_match = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(section_header);
		if (!section_match) {
			return "";
		}
		const name = section_match[1];
		if (name === undefined) {
			return "";
		}
		return name;
	}

	/** Responsibilities: _entry-point assignment extraction_. **/
	private assignment_target(assignment_line: string): string {
		const assignment = /^\s*[^=]+?\s*=\s*(['"])([^'"]+)\1\s*(?:#.*)?$/.exec(assignment_line);
		if (!assignment) {
			return "";
		}
		const target = assignment[2];
		if (target === undefined) {
			return "";
		}
		return target;
	}

	/** Responsibilities: _entry-point module extraction_. **/
	private target_module(target: string): string {
		const separator = target.indexOf(":");
		if (separator < 1) {
			return "";
		}
		return target.slice(0, separator);
	}

	/** Responsibilities: _entry-point symbol extraction_. **/
	private target_symbol(target: string): string {
		const separator = target.indexOf(":");
		if (separator < 0) {
			return "";
		}
		const exported_name = target.slice(separator + 1);
		const attribute = exported_name.indexOf(".");
		if (attribute < 0) {
			return exported_name;
		}
		return exported_name.slice(0, attribute);
	}

	/** Responsibilities: _entry-point usage registration_. **/
	private append_usage(file: string, symbol_name: string): void {
		const relative_file = relative(this._root, file).split("\\").join("/");
		let names = this._usages.get(relative_file);
		if (names === undefined) {
			names = new Set<string>();
			this._usages.set(relative_file, names);
		}
		names.add(symbol_name);
	}

	/** Responsibilities: _direct module target lookup_. **/
	private direct_target(module_path: string): string {
		const module_file = resolve(this._root, `${module_path}.py`);
		if (this._files.has(module_file)) {
			return module_file;
		}
		const package_file = resolve(this._root, module_path, PYTHON_PACKAGE_MARKER);
		if (this._files.has(package_file)) {
			return package_file;
		}
		return "";
	}

	/** Responsibilities: _unique package path matching_. **/
	private suffix_target(module_path: string): string {
		const module_suffix = `/${module_path}.py`;
		const package_suffix = `/${module_path}/${PYTHON_PACKAGE_MARKER}`;
		let match = "";
		for (const file of this._files) {
			const normalized_file = file.replaceAll("\\", "/");
			if (!normalized_file.endsWith(module_suffix) && !normalized_file.endsWith(package_suffix)) {
				continue;
			}
			if (match) {
				return "";
			}
			match = file;
		}
		return match;
	}

	/** Responsibilities: _entry-point assignment parsing_. **/
	private append_assignment(assignment_line: string): void {
		const target = this.assignment_target(assignment_line);
		if (!target) {
			return;
		}
		const module_name = this.target_module(target);
		const symbol_name = this.target_symbol(target);
		if (!module_name || !symbol_name) {
			return;
		}
		const file = this.resolve_target_file(module_name);
		if (!file) {
			return;
		}
		this.append_usage(file, symbol_name);
	}

	/** Responsibilities: _entry-point table parsing_. **/
	private collect_entry_points(source: string): void {
		let inside_entry_points = false;
		for (const line of source.split("\n")) {
			const section = this.section_name(line);
			if (section) {
				inside_entry_points = section.startsWith("project.entry-points.");
				continue;
			}
			if (inside_entry_points) {
				this.append_assignment(line);
			}
		}
	}

	/** Responsibilities: _entry-point collection state_. **/
	public constructor(root: string, files: ReadonlySet<string>, source_io: ProjectSourceIOContract) {
		this._root = root;
		this._files = files;
		this._source_io = source_io;
		this._usages = new Map<string, Set<string>>();
	}

	/** Responsibilities: _entry-point target lookup_, _ambiguous module rejection_. **/
	public resolve_target_file(module_name: string): string {
		const module_path = module_name.split(".").join("/");
		const direct = this.direct_target(module_path);
		if (direct) {
			return direct;
		}
		return this.suffix_target(module_path);
	}

	/** Responsibilities: _project entry-point usage collection_. **/
	public collect(): ReadonlyStringSetMap {
		const project_file = resolve(this._root, PYTHON_PROJECT_CONFIGURATION_FILE);
		if (!this._source_io.source_available(project_file)) {
			return this._usages;
		}
		this.collect_entry_points(this._source_io.source_text(project_file));
		return this._usages;
	}
}
