import { dirname, join, relative } from "node:path";
import { PYTHON_PACKAGE_MARKER } from "src/constants";

/** Responsibilities: _package path resolution_, _import boundary calculation_. **/
export class PlacementPath {
	private readonly files: ReadonlySet<string>;

	/** Responsibilities: _placement path dependencies_. **/
	public constructor(files: ReadonlySet<string>) {
		this.files = files;
	}

	/** Responsibilities: _Python package boundary_. **/
	public python_package_root(root: string, file: string): string {
		if (!file.endsWith(".py")) {
			return "";
		}
		let directory = dirname(file);
		while (directory.startsWith(root)) {
			if (this.files.has(join(directory, PYTHON_PACKAGE_MARKER))) {
				return directory;
			}
			if (directory === root) {
				break;
			}
			directory = dirname(directory);
		}
		return "";
	}

	/** Responsibilities: _repository path parts_. **/
	public path_parts(root: string, file: string): string[] {
		const directory = dirname(file);
		const relative_directory = relative(root, directory).replaceAll("\\", "/");
		if (relative_directory.length === 0) {
			return [];
		}
		return relative_directory.split("/").filter(Boolean);
	}

	/** Responsibilities: _boundary-relative path parts_. **/
	public boundary_path_parts(root: string, boundary: string, file: string): string[] {
		if (boundary.length === 0) {
			return this.path_parts(root, file);
		}
		if (!file.startsWith(`${boundary}/`)) {
			return this.path_parts(root, file);
		}
		return relative(boundary, dirname(file)).split("/").filter(Boolean);
	}

	/** Responsibilities: _shared path parts_. **/
	public common_parts(paths: string[][]): string[] {
		if (paths.length === 0) {
			return [];
		}
		const result: string[] = [];
		for (let index = 0; ; index += 1) {
			const part = paths[0][index];
			if (part === undefined) {
				return result;
			}
			if (paths.some((path) => path[index] !== part)) {
				return result;
			}
			result.push(part);
		}
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
