import { isAbsolute, relative } from "node:path";

/** Responsibilities: _module root selection_, _package root selection_. **/
export class TestTargetDeclarationPath {
	private readonly _project_root: string;
	private readonly _declaration_path: string;

	/** Responsibilities: _project-relative declaration path_. **/
	private project_relative_path(): string {
		if (isAbsolute(this._declaration_path)) {
			return relative(this._project_root, this._declaration_path);
		}
		return this._declaration_path;
	}

	/** Responsibilities: _source module segments_. **/
	private source_segments(): string[] {
		const segments = this._declaration_path.replaceAll("\\", "/").split("/").filter(Boolean);
		const source_index = segments.indexOf("src");
		if (source_index >= 0) {
			return segments.slice(source_index + 1);
		}
		const tools_index = segments.indexOf("tools");
		if (tools_index >= 0) {
			return segments.slice(tools_index);
		}
		return segments;
	}

	/** Responsibilities: _source module stem_. **/
	private module_stem(): string {
		const segments = this._declaration_path.replaceAll("\\", "/").split("/").filter(Boolean);
		const last_segment = segments.at(-1);
		if (last_segment === undefined) {
			return "";
		}
		return last_segment.replace(/\.(?:[cm]?[jt]sx?|py)$/, "");
	}

	/** Responsibilities: _declaration path initialization_. **/
	public constructor(project_root: string, declaration_path: string) {
		this._project_root = project_root;
		this._declaration_path = declaration_path;
	}

	/** Responsibilities: _source module root selection_. **/
	public source_module_root(): string[] {
		const source_segments = this.source_segments();
		const module_name = this.module_stem();
		if (module_name.length === 0 || source_segments.length === 0) {
			return [];
		}
		if (source_segments.length === 1) {
			return [module_name];
		}
		source_segments.pop();
		return source_segments;
	}

	/** Responsibilities: _nested package root selection_. **/
	public nested_package_root(): string[] {
		const segments = this.project_relative_path().replaceAll("\\", "/").split("/").filter(Boolean);
		const source_index = segments.indexOf("src");
		if (source_index <= 0) {
			return [];
		}
		return segments.slice(0, source_index);
	}
}
