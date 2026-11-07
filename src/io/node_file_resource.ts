import {
	appendFileSync,
	copyFileSync,
	existsSync,
	lstatSync,
	readFileSync,
	realpathSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { FileMetadata, FileResourceContract } from "src/io/protocols";

/** Responsibilities: _bound filesystem file identity_, _file operations_. **/
export class NodeFileResource implements FileResourceContract {
	private readonly _file_path: string;

	/** Responsibilities: _filesystem path ownership_. **/
	public constructor(project_root: string, path: string) {
		this._file_path = resolve(project_root, path);
	}

	/** Responsibilities: _bound filesystem path access_. **/
	public path(): string {
		return this._file_path;
	}

	/** Responsibilities: _file existence_. **/
	public path_exists(): boolean {
		return existsSync(this._file_path);
	}

	/** Responsibilities: _symbolic link detection_. **/
	public symbolic_link(): boolean {
		const stats = lstatSync(this._file_path, { throwIfNoEntry: false });
		if (stats === undefined) {
			return false;
		}
		return stats.isSymbolicLink();
	}

	/** Responsibilities: _canonical existing path resolution_. **/
	public real_path(): string {
		return resolve(realpathSync(this._file_path));
	}

	/** Responsibilities: _filesystem metadata retrieval_. **/
	public metadata(): FileMetadata {
		const stats = statSync(this._file_path);
		const metadata = { size: stats.size, mtime_ms: stats.mtimeMs, ctime_ms: stats.ctimeMs };
		return Object.freeze(metadata);
	}

	/** Responsibilities: _file text retrieval_. **/
	public file_text(): string {
		return readFileSync(this._file_path, "utf8");
	}

	/** Responsibilities: _text file replacement_. **/
	public write_text(text: string): void {
		writeFileSync(this._file_path, text, "utf8");
	}

	/** Responsibilities: _text file extension_. **/
	public append_text(text: string): void {
		appendFileSync(this._file_path, text, "utf8");
	}

	/** Responsibilities: _file duplication_. **/
	public copy_to(destination: FileResourceContract): void {
		copyFileSync(this._file_path, destination.path());
	}

	/** Responsibilities: _file movement_. **/
	public move_to(destination: FileResourceContract): void {
		renameSync(this._file_path, destination.path());
	}

	/** Responsibilities: _file removal_. **/
	public remove_file(): void {
		unlinkSync(this._file_path);
	}
}
