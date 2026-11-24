import { type Hash, createHash } from "node:crypto";
import { join, relative } from "node:path";
import { IGNORED_DIRS } from "src/constants";
import type { ReviewStateIdentityContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review source fingerprinting_, _review state compatibility checks_. **/

export class ReviewStateIdentity implements ReviewStateIdentityContract {
	private readonly _ignored_directories: Set<string>;
	private readonly _root: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _review source file discovery_. **/
	private source_files(directory: string): string[] {
		const files: string[] = [];
		for (const entry of this._file_io.list_entries(directory)) {
			if (entry.is_directory && this._ignored_directories.has(entry.name)) {
				continue;
			}
			const file = join(directory, entry.name);
			if (entry.is_directory) {
				files.push(...this.source_files(file));
				continue;
			}
			if (entry.is_file) {
				files.push(file);
			}
		}
		return files;
	}

	/** Responsibilities: _file identity framing_. **/
	private append_file_identity(digest: Hash, file: string): void {
		const name = relative(this._root, file);
		const content = Buffer.from(this._file_io.file(file).file_text(), "utf8");
		digest.update(`${Buffer.byteLength(name)}\0`);
		digest.update(name);
		digest.update(`${content.byteLength}\0`);
		digest.update(content);
	}

	/** Responsibilities: _review input identity_. **/
	public constructor(root: string, file_io: IOContract) {
		this._ignored_directories = IGNORED_DIRS;
		this._root = root;
		this._file_io = file_io;
	}

	/** Responsibilities: _review input identity calculation_. **/
	public value(): string {
		const digest = createHash("sha256");
		const files = this.source_files(this._root).sort();
		digest.update(`${files.length}\0`);
		for (const file of files) {
			this.append_file_identity(digest, file);
		}
		return digest.digest("hex");
	}

	/** Responsibilities: _review input identity matching_. **/
	public matches(expected: string): boolean {
		return this.value() === expected;
	}
}
