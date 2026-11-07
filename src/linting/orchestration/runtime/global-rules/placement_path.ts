import { dirname, join, relative } from "node:path";
import { PYTHON_PACKAGE_MARKER } from "src/constants";

/** Responsibilities: _package path resolution_, _import boundary calculation_. **/
export class PlacementPath {
	private readonly _root: string;
	private readonly _files: ReadonlySet<string>;

	/** Responsibilities: _placement path dependencies_. **/
	public constructor(root: string, files: ReadonlySet<string>) {
		this._root = root;
		this._files = files;
	}

	/** Responsibilities: _Python package boundary_. **/
	public python_package_root(file: string): string {
		if (!file.endsWith(".py")) {
			return "";
		}
		let directory = dirname(file);
		while (directory.startsWith(this._root)) {
			if (this._files.has(join(directory, PYTHON_PACKAGE_MARKER))) {
				return directory;
			}
			if (directory === this._root) {
				break;
			}
			directory = dirname(directory);
		}
		return "";
	}

	/** Responsibilities: _boundary-relative path parts_. **/
	public boundary_path_parts(boundary: string, file: string): string[] {
		if (boundary.length > 0 && file.startsWith(`${boundary}/`)) {
			return relative(boundary, dirname(file)).split("/").filter(Boolean);
		}
		const directory = dirname(file);
		const relative_directory = relative(this._root, directory).replaceAll("\\", "/");
		if (relative_directory.length === 0) {
			return [];
		}
		return relative_directory.split("/").filter(Boolean);
	}

	/** Responsibilities: _shared path parts_. **/
	public common_parts(paths: string[][]): string[] {
		const first_path = paths.at(0);
		if (first_path === undefined) {
			return [];
		}
		const result: string[] = [];
		for (let index = 0; index < first_path.length; index += 1) {
			const part = first_path[index];
			if (part === undefined || paths.some((path) => path[index] !== part)) {
				break;
			}
			result.push(part);
		}
		return result;
	}

	/** Responsibilities: _focused folder distinction_. **/
	public focused_folder_distinct(target_parts: string[], common: string[], importer_parts: string[][]): boolean {
		const focused_folder = target_parts[common.length];
		if (focused_folder === undefined) {
			return false;
		}
		return importer_parts.every((parts) => !parts.slice(common.length).includes(focused_folder));
	}
}
