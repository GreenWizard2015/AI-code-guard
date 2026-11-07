import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { NodeFileResource } from "src/io/node_file_resource";
import type { FileEntry, FileResourceContract, IOContract } from "src/io/protocols";

/** Responsibilities: _file service ownership_, _directory service ownership_. **/
export class NodeFileIO implements IOContract {
	private readonly _project_root: string;

	/** Responsibilities: _filesystem adapter composition_. **/
	public constructor(project_root: string) {
		this._project_root = resolve(project_root);
	}

	/** Responsibilities: _path-bound file access_. **/
	public file(file_path: string): FileResourceContract {
		return new NodeFileResource(this._project_root, file_path);
	}

	/** Responsibilities: _filesystem file detection_. **/
	public path_is_file(file_candidate: string): boolean {
		const resolved_path = resolve(this._project_root, file_candidate);
		if (!existsSync(resolved_path)) {
			return false;
		}
		return statSync(resolved_path).isFile();
	}

	/** Responsibilities: _filesystem directory detection_. **/
	public path_is_directory(directory_candidate: string): boolean {
		const resolved_path = resolve(this._project_root, directory_candidate);
		if (!existsSync(resolved_path)) {
			return false;
		}
		return statSync(resolved_path).isDirectory();
	}

	/** Responsibilities: _directory file inventory_. **/
	public list_files(files_directory: string): readonly string[] {
		return this.list_entries(files_directory)
			.filter((entry) => entry.is_file)
			.map((entry) => entry.name);
	}

	/** Responsibilities: _filesystem entry classification_. **/
	public list_entries(entries_directory: string): readonly FileEntry[] {
		return readdirSync(resolve(this._project_root, entries_directory), { withFileTypes: true }).map((entry) => ({
			name: entry.name,
			is_file: entry.isFile(),
			is_directory: entry.isDirectory(),
		}));
	}

	/** Responsibilities: _directory creation_. **/
	public create_directory(directory_to_create: string): void {
		mkdirSync(resolve(this._project_root, directory_to_create), { recursive: true });
	}

	/** Responsibilities: _exclusive directory creation_. **/
	public create_directory_exclusive(directory_path: string): void {
		mkdirSync(resolve(this._project_root, directory_path));
	}

	/** Responsibilities: _path movement_. **/
	public move_path(source_path: string, destination_path: string): void {
		const resolved_source = resolve(this._project_root, source_path);
		const resolved_destination = resolve(this._project_root, destination_path);
		renameSync(resolved_source, resolved_destination);
	}

	/** Responsibilities: _temporary directory creation_. **/
	public temporary_directory(parent_directory: string, prefix: string): string {
		return mkdtempSync(join(resolve(this._project_root, parent_directory), prefix));
	}

	/** Responsibilities: _recursive path removal_. **/
	public remove_path(path_to_remove: string): void {
		rmSync(resolve(this._project_root, path_to_remove), { recursive: true, force: true });
	}
}
