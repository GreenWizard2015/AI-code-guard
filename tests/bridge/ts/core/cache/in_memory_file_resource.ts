import type { FileMetadata, FileResourceContract } from "src/io/protocols";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _bound virtual file identity_, _virtual file operations_. **/
export class InMemoryFileResource implements FileResourceContract {
	private readonly _file_path: string;
	private readonly _file_io: InMemoryFileIO;

	/** Responsibilities: _virtual file path ownership_. **/
	public constructor(file_io: InMemoryFileIO, path: string) {
		this._file_path = path;
		this._file_io = file_io;
	}

	/** Responsibilities: _virtual file path access_. **/
	public path(): string {
		return this._file_path;
	}

	/** Responsibilities: _virtual file operation access_. **/
	public path_exists(): boolean {
		return this._file_io.path_exists(this._file_path);
	}

	/** Responsibilities: _virtual symbolic link inspection_. **/
	public symbolic_link(): boolean {
		return this._file_io.symbolic_link(this._file_path);
	}

	/** Responsibilities: _virtual canonical path resolution_. **/
	public real_path(): string {
		return this._file_io.real_path(this._file_path);
	}

	/** Responsibilities: _virtual file metadata retrieval_. **/
	public metadata(): FileMetadata {
		return this._file_io.metadata(this._file_path);
	}

	/** Responsibilities: _virtual file text retrieval_. **/
	public file_text(): string {
		return this._file_io.file_text(this._file_path);
	}

	/** Responsibilities: _virtual text replacement_. **/
	public write_text(text: string): void {
		this._file_io.write_text(this._file_path, text);
	}

	/** Responsibilities: _virtual text extension_. **/
	public append_text(text: string): void {
		this._file_io.append_text(this._file_path, text);
	}

	/** Responsibilities: _virtual file duplication_. **/
	public copy_to(destination: FileResourceContract): void {
		this._file_io.copy_file(this._file_path, destination.path());
	}

	/** Responsibilities: _virtual file movement_. **/
	public move_to(destination: FileResourceContract): void {
		this._file_io.move_file(this._file_path, destination.path());
	}

	/** Responsibilities: _virtual file removal_. **/
	public remove_file(): void {
		this._file_io.remove_file(this._file_path);
	}
}
