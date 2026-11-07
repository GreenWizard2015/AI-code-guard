import { basename, dirname, extname, relative } from "node:path";
import {
	MIN_PER_DIRECTORY,
	MODULE_CONSTANT_KIND,
	MODULE_INTERFACE_KIND,
	MODULE_PROTOCOL_KIND,
	MODULE_TYPE_KIND,
	PLACEMENT_DIAGNOSTIC_GUIDANCE,
} from "src/constants";
import { PlacementPath } from "src/linting/orchestration/runtime/global-rules/placement_path";
import { MODULE_FUNCTION_KIND, MODULE_PROTOCOL_NAME } from "src/rules/constants";
import type { PlacementAnalysisContract } from "src/shared_services_protocols";
import type { RuleParameters } from "src/types";

/** Responsibilities: _placement candidate analysis_, _destination path suggestions_. **/
export class PlacementAnalysis implements PlacementAnalysisContract {
	private readonly _target_path: string;
	private readonly _importers: string[];
	private readonly _root: string;
	private readonly _placement_path: PlacementPath;
	private readonly _directory_source_counts: ReadonlyMap<string, number>;
	private readonly _boundary: string;
	private readonly _target_parts: string[];
	private readonly _importer_parts: string[][];
	private readonly _common_parts: string[];
	private readonly _common: string;

	/** Responsibilities: _suggested module locations_. **/
	private suggested_locations(): string {
		const file_name = basename(this._target_path);
		const stem = file_name.slice(0, -extname(file_name).length);
		let common_file = `${this._common}/${file_name}`;
		if (!this._common) {
			common_file = file_name;
		}
		const caller_folders = new Set(this._importer_parts.flat());
		let folder = stem;
		if (caller_folders.has(stem)) {
			folder = "focused";
		}
		let focused_file = `${this._common}/${folder}/${file_name}`;
		if (!this._common) {
			focused_file = `${folder}/${file_name}`;
		}
		return `${common_file} or ${focused_file}`;
	}

	/** Responsibilities: _member location prefix_. **/
	private common_prefix(): string {
		if (!this._common) {
			return "";
		}
		return `${this._common}/`;
	}

	/** Responsibilities: _package placement path_. **/
	private package_prefix(): string {
		if (!this._boundary) {
			return "";
		}
		return relative(this._root, this._boundary).replaceAll("\\", "/");
	}

	/** Responsibilities: _package-qualified placement path_. **/
	private qualify_package_path(path: string): string {
		const prefix = this.package_prefix();
		if (!prefix) {
			return path;
		}
		return `${prefix}/${path}`;
	}

	/** Responsibilities: _construction importer names_. **/
	private importer_names(): string {
		return this._importers
			.map((file) => relative(this._root, file))
			.sort()
			.join(", ");
	}

	/** Responsibilities: _focused folder placement candidate_. **/
	private has_distinct_folder(): boolean {
		if (this._target_parts.length <= this._common_parts.length) {
			return false;
		}
		return this._placement_path.focused_folder_distinct(this._target_parts, this._common_parts, this._importer_parts);
	}

	/** Responsibilities: _grouped module classification_. **/
	private grouped_module(): boolean {
		const shared_parts = this._placement_path.common_parts([this._target_parts, ...this._importer_parts]);
		const grouping_depth = this._target_parts.length - shared_parts.length;
		if (grouping_depth < 1 || grouping_depth > 2) {
			return false;
		}
		const source_count = this._directory_source_counts.get(dirname(this._target_path));
		if (source_count === undefined) {
			return false;
		}
		return source_count >= MIN_PER_DIRECTORY;
	}

	/** Responsibilities: _target placement acceptance_. **/
	private has_acceptable_placement(): boolean {
		if (this.grouped_module() || this.has_distinct_folder()) {
			return false;
		}
		if (this._importers.length === 1) {
			const importer_parts = this._importer_parts.at(0);
			if (importer_parts === undefined) {
				return false;
			}
			return this._target_parts.join("/") !== importer_parts.join("/");
		}
		return this._target_parts.length - this._common_parts.length >= 2;
	}

	/** Responsibilities: _placement analysis initialization_. **/
	public constructor(
		root: string,
		files: ReadonlySet<string>,
		target: string,
		importers: string[],
		directory_source_counts: ReadonlyMap<string, number>,
	) {
		this._root = root;
		this._directory_source_counts = directory_source_counts;
		this._target_path = target;
		this._importers = importers;
		this._placement_path = new PlacementPath(root, files);
		this._boundary = this._placement_path.python_package_root(target);
		this._target_parts = this._placement_path.boundary_path_parts(this._boundary, target);
		this._importer_parts = importers.map((file) => this._placement_path.boundary_path_parts(this._boundary, file));
		this._common_parts = this._placement_path.common_parts(this._importer_parts);
		this._common = this._common_parts.join("/");
	}

	/** Responsibilities: _placement target path_. **/
	public target(): string {
		return this._target_path;
	}

	/** Responsibilities: _placement acceptance_. **/
	public valid(): boolean {
		if (this._boundary && this._target_parts.length === 0) {
			return false;
		}
		return this.has_acceptable_placement();
	}

	/** Responsibilities: _member destination lookup_. **/
	public member_location(kind: string): string {
		const prefix = this.common_prefix();
		const extension = extname(this._target_path);
		if (kind === MODULE_CONSTANT_KIND) {
			return this.qualify_package_path(`${prefix}constants${extension}`);
		}
		if (kind === MODULE_TYPE_KIND || kind === MODULE_INTERFACE_KIND || kind === MODULE_PROTOCOL_KIND) {
			let file_name = "types";
			if (kind === MODULE_PROTOCOL_KIND) {
				file_name = MODULE_PROTOCOL_NAME;
			}
			return this.qualify_package_path(`${prefix}${file_name}${extension}`);
		}
		if (kind === MODULE_FUNCTION_KIND) {
			return this.qualify_package_path(`functions${extension}`);
		}
		return this.qualify_package_path(this.suggested_locations());
	}

	/** Responsibilities: _placement diagnostic parameters_. **/
	public parameters(members: string): RuleParameters {
		return {
			target: relative(this._root, this._target_path),
			importers: this.importer_names(),
			members,
			placement_message: "module is placed deeper than its import boundary",
			suggestions: this.qualify_package_path(this.suggested_locations()),
			guidance: PLACEMENT_DIAGNOSTIC_GUIDANCE,
		};
	}
}
