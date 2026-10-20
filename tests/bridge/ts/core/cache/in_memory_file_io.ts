import { dirname, relative, resolve, sep } from "node:path";
import type {
	DirectoryEntriesContract,
	DirectoryOperationsContract,
	FileContentContract,
	FileEntryContract,
	FileMetadataContract,
	FileOperationsContract,
	FilePathContract,
	IOContract,
} from "src/io/protocols";

/** Responsibilities: _virtual file content_, _virtual directory ownership_. **/
export class InMemoryFileIO implements IOContract {
	private readonly file_contents: Map<string, string>;
	private readonly directory_paths: Set<string>;
	private readonly symbolic_links: Map<string, string>;
	private readonly metadata_values: Map<string, FileMetadataContract>;
	private readonly preserved_metadata_paths: Set<string>;
	public readonly file_paths: FilePathContract;
	public readonly file_content: FileContentContract;
	public readonly file_operations: FileOperationsContract;
	public readonly directory_entries: DirectoryEntriesContract;
	public readonly directory_operations: DirectoryOperationsContract;
	private clock = 1;
	private temporary_directory_sequence = 0;

	/** Responsibilities: _virtual filesystem error construction_. **/
	private failure(message: string): Error {
		const error = new Error(message);
		error.name = "ENOENT";
		Object.defineProperty(error, "code", { value: "ENOENT" });
		return error;
	}

	/** Responsibilities: _virtual metadata versioning_. **/
	private touch(path: string, size = 0): void {
		const absolute_path = resolve(path);
		if (this.preserved_metadata_paths.has(absolute_path)) {
			return;
		}
		const time = this.clock;
		this.clock += 1;
		this.metadata_values.set(absolute_path, { size, mtime_ms: time, ctime_ms: time });
	}

	/** Responsibilities: _virtual directory hierarchy registration_. **/
	private directory_chain(directory: string): void {
		const absolute_directory = resolve(directory);
		if (this.directory_paths.has(absolute_directory)) {
			return;
		}
		const parent = dirname(absolute_directory);
		if (parent !== absolute_directory) {
			this.directory_chain(parent);
		}
		this.directory_paths.add(absolute_directory);
		this.touch(absolute_directory);
	}

	/** Responsibilities: _virtual path ancestry check_. **/
	private is_within(directory: string, path: string): boolean {
		const directory_prefix = `${resolve(directory)}${sep}`;
		return resolve(path).startsWith(directory_prefix);
	}

	/** Responsibilities: _virtual filesystem setup_. **/
	public constructor() {
		this.file_contents = new Map();
		this.directory_paths = new Set();
		this.symbolic_links = new Map();
		this.metadata_values = new Map();
		this.preserved_metadata_paths = new Set();
		this.file_paths = this;
		this.file_content = this;
		this.file_operations = this;
		this.directory_entries = this;
		this.directory_operations = this;
	}

	/** Responsibilities: _initial virtual file population_. **/
	public seed_files(files: ReadonlyMap<string, string>): void {
		for (const [path, text] of files) {
			const file = resolve(path);
			this.file_contents.set(file, text);
			this.directory_chain(dirname(file));
			this.touch(file, Buffer.byteLength(text, "utf8"));
		}
	}

	/** Responsibilities: _virtual path metadata retrieval_. **/
	public metadata(path: string): FileMetadataContract {
		const value = this.metadata_values.get(this.real_path(path));
		if (value === undefined) {
			throw this.failure(`Path does not exist: ${path}`);
		}
		return value;
	}

	/** Responsibilities: _stable metadata test setup_. **/
	public preserve_metadata(path: string): void {
		const absolute_path = resolve(path);
		this.metadata(absolute_path);
		this.preserved_metadata_paths.add(absolute_path);
	}

	/** Responsibilities: _virtual file existence_. **/
	public path_exists(path: string): boolean {
		if (path.length === 0) {
			return false;
		}
		const absolute_path = this.real_path(path);
		return this.file_contents.has(absolute_path) || this.directory_paths.has(absolute_path);
	}

	/** Responsibilities: _virtual symbolic link detection_. **/
	public symbolic_link(path: string): boolean {
		return this.symbolic_links.has(resolve(path));
	}

	/** Responsibilities: _virtual canonical path resolution_. **/
	public real_path(path: string): string {
		let resolved_path = resolve(path);
		for (let iteration = 0; iteration < this.symbolic_links.size + 1; iteration += 1) {
			let matching_link = "";
			let matching_target = "";
			for (const [link, target] of this.symbolic_links) {
				if (
					(resolved_path === link || resolved_path.startsWith(`${link}${sep}`)) &&
					link.length > matching_link.length
				) {
					matching_link = link;
					matching_target = target;
				}
			}
			if (matching_link.length === 0) {
				return resolved_path;
			}
			resolved_path = resolve(matching_target, relative(matching_link, resolved_path));
		}
		throw this.failure(`Symbolic link cycle: ${path}`);
	}

	/** Responsibilities: _virtual symbolic link creation_. **/
	public create_symbolic_link(path: string, target: string): void {
		const absolute_path = resolve(path);
		if (!this.directory_paths.has(dirname(absolute_path))) {
			throw this.failure(`Parent directory does not exist: ${dirname(absolute_path)}`);
		}
		this.symbolic_links.set(absolute_path, resolve(dirname(absolute_path), target));
	}

	/** Responsibilities: _virtual file lookup_. **/
	public path_is_file(path: string): boolean {
		const absolute_path = this.real_path(path);
		return this.file_contents.has(absolute_path);
	}

	/** Responsibilities: _virtual directory lookup_. **/
	public path_is_directory(path: string): boolean {
		const absolute_path = this.real_path(path);
		return this.directory_paths.has(absolute_path);
	}

	/** Responsibilities: _virtual text retrieval_. **/
	public file_text(file: string): string {
		const text = this.file_contents.get(this.real_path(file));
		if (text === undefined) {
			throw this.failure(`File does not exist: ${file}`);
		}
		return text;
	}

	/** Responsibilities: _virtual text replacement_. **/
	public write_text(file: string, text: string): void {
		const absolute_file = resolve(file);
		if (!this.directory_paths.has(dirname(absolute_file))) {
			throw this.failure(`Parent directory does not exist: ${dirname(absolute_file)}`);
		}
		this.file_contents.set(absolute_file, text);
		this.touch(absolute_file, Buffer.byteLength(text, "utf8"));
		this.touch(dirname(absolute_file));
	}

	/** Responsibilities: _virtual text concatenation_. **/
	public append_text(file: string, text: string): void {
		const absolute_file = resolve(file);
		const previous = this.file_contents.get(absolute_file);
		if (previous === undefined) {
			this.write_text(absolute_file, text);
			return;
		}
		this.file_contents.set(absolute_file, `${previous}${text}`);
		this.touch(absolute_file, Buffer.byteLength(`${previous}${text}`, "utf8"));
		this.touch(dirname(absolute_file));
	}

	/** Responsibilities: _virtual directory creation_. **/
	public create_directory(directory: string): void {
		this.directory_chain(directory);
	}

	/** Responsibilities: _exclusive virtual directory creation_. **/
	public create_directory_exclusive(directory: string): void {
		const absolute_directory = resolve(directory);
		if (this.path_exists(absolute_directory)) {
			throw this.failure(`Path already exists: ${directory}`);
		}
		if (!this.directory_paths.has(dirname(absolute_directory))) {
			throw this.failure(`Parent directory does not exist: ${dirname(absolute_directory)}`);
		}
		this.directory_paths.add(absolute_directory);
		this.touch(absolute_directory);
		this.touch(dirname(absolute_directory));
	}

	/** Responsibilities: _direct-child file inventory_. **/
	public list_files(directory: string): readonly string[] {
		const absolute_directory = resolve(directory);
		if (!this.directory_paths.has(absolute_directory)) {
			throw this.failure(`Directory does not exist: ${directory}`);
		}
		return Array.from(this.file_contents.keys())
			.filter((file) => dirname(file) === absolute_directory)
			.map((file) => file.slice(absolute_directory.length + 1));
	}

	/** Responsibilities: _virtual directory entry classification_. **/
	public list_entries(directory: string): readonly FileEntryContract[] {
		const absolute_directory = resolve(directory);
		if (!this.directory_paths.has(absolute_directory)) {
			throw this.failure(`Directory does not exist: ${directory}`);
		}
		const entries = new Map<string, FileEntryContract>();
		for (const file of this.file_contents.keys()) {
			if (dirname(file) === absolute_directory) {
				const name = file.slice(absolute_directory.length + 1);
				entries.set(name, { name, is_file: true, is_directory: false });
			}
		}
		for (const child of this.directory_paths) {
			if (dirname(child) === absolute_directory) {
				const name = child.slice(absolute_directory.length + 1);
				entries.set(name, { name, is_file: false, is_directory: true });
			}
		}
		return [...entries.values()];
	}

	/** Responsibilities: _virtual atomic file movement_. **/
	public move_file(source: string, destination: string): void {
		const absolute_source = resolve(source);
		const text = this.file_text(absolute_source);
		this.write_text(destination, text);
		this.file_contents.delete(absolute_source);
		this.metadata_values.delete(absolute_source);
		this.touch(dirname(absolute_source));
	}

	/** Responsibilities: _virtual file duplication_. **/
	public copy_file(source: string, destination: string): void {
		this.write_text(destination, this.file_text(source));
	}

	/** Responsibilities: _virtual path relocation_. **/
	public move_path(source: string, destination: string): void {
		const absolute_source = resolve(source);
		const absolute_destination = resolve(destination);
		if (this.file_contents.has(absolute_source)) {
			this.move_file(absolute_source, absolute_destination);
			return;
		}
		if (this.path_exists(absolute_destination)) {
			throw this.failure(`Destination already exists: ${destination}`);
		}
		if (!this.directory_paths.has(absolute_source)) {
			throw this.failure(`Path does not exist: ${source}`);
		}
		const parent = dirname(absolute_destination);
		if (!this.directory_paths.has(parent)) {
			throw this.failure(`Parent directory does not exist: ${parent}`);
		}
		const source_prefix = `${absolute_source}${sep}`;
		const file_entries = [...this.file_contents.entries()];
		const files = file_entries.filter(([file]) => file.startsWith(source_prefix));
		const directory_entries = [...this.directory_paths];
		const directories = directory_entries.filter(
			(directory) => directory === absolute_source || directory.startsWith(source_prefix),
		);
		this.remove_directory(absolute_source);
		for (const directory of directories) {
			this.create_directory(directory.replace(absolute_source, absolute_destination));
		}
		for (const [file, text] of files) {
			this.write_text(file.replace(absolute_source, absolute_destination), text);
		}
	}

	/** Responsibilities: _temporary directory allocation_. **/
	public temporary_directory(parent: string, prefix: string): string {
		const absolute_parent = resolve(parent);
		if (!this.directory_paths.has(absolute_parent)) {
			throw this.failure(`Parent directory does not exist: ${parent}`);
		}
		const directory = resolve(absolute_parent, `${prefix}${this.temporary_directory_sequence}`);
		this.temporary_directory_sequence += 1;
		this.create_directory(directory);
		return directory;
	}

	/** Responsibilities: _virtual file removal_. **/
	public remove_file(file: string): void {
		const absolute_file = resolve(file);
		if (!this.file_contents.delete(absolute_file)) {
			throw this.failure(`File does not exist: ${file}`);
		}
		this.metadata_values.delete(absolute_file);
		this.touch(dirname(absolute_file));
	}

	/** Responsibilities: _virtual recursive directory removal_. **/
	public remove_directory(directory: string): void {
		const absolute_directory = resolve(directory);
		for (const file of this.file_contents.keys()) {
			if (this.is_within(absolute_directory, file)) {
				this.file_contents.delete(file);
				this.metadata_values.delete(file);
			}
		}
		for (const child of this.directory_paths) {
			if (child === absolute_directory || this.is_within(absolute_directory, child)) {
				this.directory_paths.delete(child);
				this.metadata_values.delete(child);
			}
		}
		this.touch(dirname(absolute_directory));
	}

	/** Responsibilities: _virtual recursive path removal_. **/
	public remove_path(path: string): void {
		const absolute_path = resolve(path);
		if (this.file_contents.has(absolute_path)) {
			this.remove_file(absolute_path);
			return;
		}
		this.remove_directory(absolute_path);
	}
}
