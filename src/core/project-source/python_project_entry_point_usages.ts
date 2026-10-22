import { relative, resolve } from "node:path";
import { PYTHON_PACKAGE_MARKER, PYTHON_PROJECT_CONFIGURATION_FILE } from "src/constants";
import type { ReadonlyStringSetMap, StringSetMap } from "src/analysis_types";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _Python package entry-point parsing_, _external symbol usage lookup_. **/
export class PythonProjectEntryPointUsages {
	private readonly root: string;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _TOML section extraction_. **/
	private section_name(line: string): string {
		const section_match = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
		if (!section_match) {
			return "";
		}
		return section_match[1];
	}

	/** Responsibilities: _entry-point assignment extraction_. **/
	private assignment_target(line: string): string {
		const assignment = /^\s*[^=]+?\s*=\s*(['"])([^'"]+)\1\s*(?:#.*)?$/.exec(line);
		if (!assignment) {
			return "";
		}
		return assignment[2];
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
	private append_usage(usages: StringSetMap, file: string, symbol_name: string): void {
		const relative_file = relative(this.root, file).split("\\").join("/");
		let names = usages.get(relative_file);
		if (names === undefined) {
			names = new Set<string>();
			usages.set(relative_file, names);
		}
		names.add(symbol_name);
	}

	/** Responsibilities: _entry-point usage registration_. **/
	private append_assignment(usages: StringSetMap, line: string, files: ReadonlySet<string>): void {
		const target = this.assignment_target(line);
		if (!target) {
			return;
		}
		const module_name = this.target_module(target);
		const symbol_name = this.target_symbol(target);
		if (!module_name || !symbol_name) {
			return;
		}
		const file = this.resolve_target_file(module_name, files);
		if (!file) {
			return;
		}
		this.append_usage(usages, file, symbol_name);
	}

	/** Responsibilities: _direct module target lookup_. **/
	private direct_target(module_path: string, files: ReadonlySet<string>): string {
		const module_file = resolve(this.root, `${module_path}.py`);
		if (files.has(module_file)) {
			return module_file;
		}
		const package_file = resolve(this.root, module_path, PYTHON_PACKAGE_MARKER);
		if (files.has(package_file)) {
			return package_file;
		}
		return "";
	}

	/** Responsibilities: _unique package path matching_. **/
	private suffix_target(module_path: string, files: ReadonlySet<string>): string {
		const module_suffix = `/${module_path}.py`;
		const package_suffix = `/${module_path}/${PYTHON_PACKAGE_MARKER}`;
		let match = "";
		for (const file of files) {
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

	/** Responsibilities: _entry-point table parsing_. **/
	private collect_entry_points(source: string, files: ReadonlySet<string>, usages: StringSetMap): void {
		let inside_entry_points = false;
		for (const line of source.split("\n")) {
			const section = this.section_name(line);
			if (section) {
				inside_entry_points = section.startsWith("project.entry-points.");
				continue;
			}
			if (inside_entry_points) {
				this.append_assignment(usages, line, files);
			}
		}
	}

	/** Responsibilities: _entry-point usage initialization_. **/
	public constructor(root: string, source_io: ProjectSourceIOContract) {
		this.root = root;
		this.source_io = source_io;
	}

	/** Responsibilities: _entry-point target lookup_, _ambiguous module rejection_. **/
	public resolve_target_file(module_name: string, files: ReadonlySet<string>): string {
		const module_path = module_name.split(".").join("/");
		const direct = this.direct_target(module_path, files);
		if (direct) {
			return direct;
		}
		return this.suffix_target(module_path, files);
	}

	/** Responsibilities: _project entry-point usage collection_. **/
	public collect(files: readonly string[]): ReadonlyStringSetMap {
		const usages: StringSetMap = new Map<string, Set<string>>();
		const project_file = resolve(this.root, PYTHON_PROJECT_CONFIGURATION_FILE);
		if (!this.source_io.source_available(project_file)) {
			return usages;
		}
		const source_files = new Set(files);
		const project_text = this.source_io.source_text(project_file);
		this.collect_entry_points(project_text, source_files, usages);
		return usages;
	}
}
