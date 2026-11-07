import type { FileMetadata, FileResourceContract } from "src/io/protocols";
import type { TaskPublicationFaultIO } from "tests/bridge/ts/core/support/task-publication-fault-io";

/** Responsibilities: _file resource access_, _journal fault dispatch_. **/
export class TaskPublicationFaultFileResource implements FileResourceContract {
	private readonly _resource: FileResourceContract;
	private readonly _path: string;
	private readonly _file_io: TaskPublicationFaultIO;

	/** Responsibilities: _file resource setup_. **/
	public constructor(resource: FileResourceContract, path: string, file_io: TaskPublicationFaultIO) {
		this._resource = resource;
		this._path = path;
		this._file_io = file_io;
	}

	/** Responsibilities: _file path access_. **/
	public path(): string {
		return this._resource.path();
	}

	/** Responsibilities: _file existence lookup_. **/
	public path_exists(): boolean {
		return this._resource.path_exists();
	}

	/** Responsibilities: _symbolic link inspection_. **/
	public symbolic_link(): boolean {
		return this._resource.symbolic_link();
	}

	/** Responsibilities: _canonical path lookup_. **/
	public real_path(): string {
		return this._resource.real_path();
	}

	/** Responsibilities: _file metadata lookup_. **/
	public metadata(): FileMetadata {
		return this._resource.metadata();
	}

	/** Responsibilities: _file content lookup_. **/
	public file_text(): string {
		return this._resource.file_text();
	}

	/** Responsibilities: _journal fault dispatch_. **/
	public write_text(content: string): void {
		this._file_io.write_file(this._path, content);
	}

	/** Responsibilities: _file content storage_. **/
	public append_text(content: string): void {
		this._resource.append_text(content);
	}

	/** Responsibilities: _file content copying_. **/
	public copy_to(destination: FileResourceContract): void {
		this._resource.copy_to(destination);
	}

	/** Responsibilities: _file path movement_. **/
	public move_to(destination: FileResourceContract): void {
		this._resource.move_to(destination);
	}

	/** Responsibilities: _file removal_. **/
	public remove_file(): void {
		this._resource.remove_file();
	}
}
