import { basename, dirname, extname, relative } from "node:path";
import type { RuleParameters } from "src/types";
import {
	MODULE_CONSTANT_KIND,
	MODULE_INTERFACE_KIND,
	MODULE_PROTOCOL_KIND,
	MODULE_TYPE_KIND,
	MIN_PER_DIRECTORY,
	PLACEMENT_DIAGNOSTIC_GUIDANCE,
} from "src/constants";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import { PlacementPath } from "src/linting/orchestration/runtime/global-rules/placement_path";
import type { PlacementSupportContract } from "src/protocols";

/** Responsibilities: _placement candidate analysis_, _destination path suggestions_. **/
export class PlacementSupport implements PlacementSupportContract {
	private readonly placement_path: PlacementPath;
	private readonly files: ReadonlySet<string>;

	public readonly PLACEMENT_MESSAGE = "module is placed deeper than its import boundary";

	/** Responsibilities: _derivation candidate module locations_. **/
	private suggested_locations(common: string, file_name: string, stem: string, importer_parts: string[][]): string {
		let common_file = `${common}/${file_name}`;
		if (!common) {
			common_file = file_name;
		}
		const caller_folders = new Set(importer_parts.flat());
		let folder = stem;
		if (caller_folders.has(stem)) {
			folder = "focused";
		}
		let focused_file = `${common}/${folder}/${file_name}`;
		if (!common) {
			focused_file = `${folder}/${file_name}`;
		}
		return `${common_file} or ${focused_file}`;
	}

	/** Responsibilities: _member location prefix_. **/
	private common_prefix(common: string): string {
		if (common.length === 0) {
			return "";
		}
		return `${common}/`;
	}

	/** Responsibilities: _package placement path_. **/
	private package_prefix(root: string, boundary: string): string {
		if (boundary.length === 0) {
			return "";
		}
		return relative(root, boundary).replaceAll("\\", "/");
	}

	/** Responsibilities: _package-qualified placement path_. **/
	private qualify_package_path(root: string, boundary: string, path: string): string {
		const prefix = this.package_prefix(root, boundary);
		if (prefix.length === 0) {
			return path;
		}
		return `${prefix}/${path}`;
	}

	/** Responsibilities: _declaration member location_. **/
	private declaration_location(common: string, extension: string, kind: string): string {
		const prefix = this.common_prefix(common);
		if (kind === MODULE_CONSTANT_KIND) {
			return `${prefix}constants${extension}`;
		}
		if (kind === MODULE_TYPE_KIND || kind === MODULE_INTERFACE_KIND || kind === MODULE_PROTOCOL_KIND) {
			let file_name = "types";
			if (kind === MODULE_PROTOCOL_KIND) {
				file_name = "protocols";
			}
			return `${prefix}${file_name}${extension}`;
		}
		if (kind === MODULE_FUNCTION_KIND) {
			return `functions${extension}`;
		}
		return "";
	}

	/** Responsibilities: _focused member location_. **/
	private focused_member_location(
		common: string,
		target: string,
		extension: string,
		importer_parts: string[][],
	): string {
		const file_name = basename(target);
		const stem = file_name.slice(0, -extension.length);
		return this.suggested_locations(common, file_name, stem, importer_parts);
	}

	/** Responsibilities: _construction importer names_. **/
	private importer_names(root: string, importers: string[]): string {
		return importers
			.map((file) => relative(root, file))
			.sort()
			.join(", ");
	}

	/** Responsibilities: _construction placement suggestions_. **/
	private placement_suggestions(root: string, target: string, importers: string[]): string {
		const boundary = this.placement_path.python_package_root(root, target);
		const importer_parts = importers.map((file) => this.placement_path.boundary_path_parts(root, boundary, file));
		const common = this.placement_path.common_parts(importer_parts).join("/");
		const file_name = basename(target);
		const stem = file_name.slice(0, -extname(file_name).length);
		return this.qualify_package_path(root, boundary, this.suggested_locations(common, file_name, stem, importer_parts));
	}

	/** Responsibilities: _focused folder placement candidate_. **/
	private has_distinct_folder(target_parts: string[], common: string[], importer_parts: string[][]): boolean {
		if (target_parts.length <= common.length) {
			return false;
		}
		return this.placement_path.focused_folder_distinct(target_parts, common, importer_parts);
	}

	/** Responsibilities: _directory source count_. **/
	private source_count(directory: string): number {
		let count = 0;
		for (const file of this.files) {
			if (dirname(file) !== directory) {
				continue;
			}
			if (file.endsWith(".ts") || file.endsWith(".py")) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _grouped module source count_. **/
	private grouped_module(target_parts: string[], importer_parts: string[][], target: string): boolean {
		const shared_parts = this.placement_path.common_parts([target_parts, ...importer_parts]);
		const grouping_depth = target_parts.length - shared_parts.length;
		if (grouping_depth < 1 || grouping_depth > 2) {
			return false;
		}
		const source_count = this.source_count(dirname(target));
		return source_count >= MIN_PER_DIRECTORY;
	}

	/** Responsibilities: _target placement acceptance_. **/
	private has_acceptable_placement(
		target_parts: string[],
		common: string[],
		importer_parts: string[][],
		importers: string[],
		target: string,
	): boolean {
		if (this.grouped_module(target_parts, importer_parts, target)) {
			return false;
		}
		if (this.has_distinct_folder(target_parts, common, importer_parts)) {
			return false;
		}
		if (importers.length === 1) {
			return target_parts.join("/") !== importer_parts[0].join("/");
		}
		return target_parts.length - common.length >= 2;
	}

	/** Responsibilities: _placement source inventory initialization_. **/
	public constructor(files: ReadonlySet<string>) {
		this.files = files;
		this.placement_path = new PlacementPath(files);
	}

	/** Responsibilities: _derivation member-specific placement_. **/
	public suggested_member_location(root: string, target: string, importers: string[], kind: string): string {
		const boundary = this.placement_path.python_package_root(root, target);
		const importer_parts = importers.map((file) => this.placement_path.boundary_path_parts(root, boundary, file));
		const common = this.placement_path.common_parts(importer_parts).join("/");
		const extension = extname(target);
		const declaration = this.declaration_location(common, extension, kind);
		if (declaration.length > 0) {
			return this.qualify_package_path(root, boundary, declaration);
		}
		return this.qualify_package_path(
			root,
			boundary,
			this.focused_member_location(common, target, extension, importer_parts),
		);
	}

	/** Responsibilities: _classification target path valid_. **/
	public placement_candidate(root: string, target: string, importers: string[]): boolean {
		const boundary = this.placement_path.python_package_root(root, target);
		const target_parts = this.placement_path.boundary_path_parts(root, boundary, target);
		if (boundary.length > 0 && target_parts.length === 0) {
			return false;
		}
		const importer_parts = importers.map((file) => this.placement_path.boundary_path_parts(root, boundary, file));
		const common = this.placement_path.common_parts(importer_parts);
		return this.has_acceptable_placement(target_parts, common, importer_parts, importers, target);
	}

	/** Responsibilities: _construction diagnostic parameters module-placement_. **/
	public placement_parameters(root: string, target: string, importers: string[], members: string): RuleParameters {
		const names = this.importer_names(root, importers);
		const suggestions = this.placement_suggestions(root, target, importers);
		return {
			target: relative(root, target),
			importers: names,
			members,
			placement_message: this.PLACEMENT_MESSAGE,
			suggestions,
			guidance: PLACEMENT_DIAGNOSTIC_GUIDANCE,
		};
	}
}
