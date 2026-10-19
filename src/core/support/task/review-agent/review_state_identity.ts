import { type Hash, createHash } from "node:crypto";
import { join, relative } from "node:path";
import type { ReviewStateIdentityContract } from "src/core/support/task/review-agent/protocols";
import { IGNORED_DIRS } from "src/constants";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review source fingerprinting_, _review state compatibility checks_. **/

export class ReviewStateIdentity implements ReviewStateIdentityContract {
	private readonly ignored_directories: Set<string>;
	private readonly root: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _review source file discovery_. **/
	private source_files(directory: string): string[] {
		const files: string[] = [];
		for (const entry of this.file_io.directory_entries.list_entries(directory)) {
			if (entry.is_directory && this.ignored_directories.has(entry.name)) {
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
		const name = relative(this.root, file);
		const content = Buffer.from(this.file_io.file_content.file_text(file), "utf8");
		digest.update(`${Buffer.byteLength(name)}\0`);
		digest.update(name);
		digest.update(`${content.byteLength}\0`);
		digest.update(content);
	}

	/** Responsibilities: _review input identity_. **/
	public constructor(root: string, file_io: IOContract) {
		this.ignored_directories = IGNORED_DIRS;
		this.root = root;
		this.file_io = file_io;
	}

	/** Responsibilities: _review input identity calculation_. **/
	public value(): string {
		const digest = createHash("sha256");
		const files = this.source_files(this.root).sort();
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
