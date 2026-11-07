import { createHash } from "node:crypto";
import type { Hash } from "node:crypto";
import type { LintDirectoryFingerprint, LintFileFingerprint } from "src/project_analysis_types";

/** Responsibilities: _lint cache identity digest_, _stable cache input encoding_. **/
export class LintExecutionCacheIdentity {
	private readonly _hash: Hash;

	/** Responsibilities: _digest state initialization_. **/
	public constructor(identity_header: string) {
		this._hash = createHash("sha256");
		this._hash.update(identity_header);
	}

	/** Responsibilities: _file selection identity_. **/
	public append_selection(selection: readonly string[]): void {
		this._hash.update("[");
		const ordered_selection = [...selection];
		ordered_selection.sort();
		for (const file of ordered_selection) {
			this._hash.update(`${file}\u0000`);
		}
		this._hash.update("]");
	}

	/** Responsibilities: _file fingerprint identity encoding_. **/
	public append_fingerprints(fingerprints: readonly LintFileFingerprint[]): void {
		for (const fingerprint of fingerprints) {
			this._hash.update(`${fingerprint.file}\u0000${fingerprint.content_hash}\u0000`);
		}
	}

	/** Responsibilities: _directory fingerprint identity encoding_. **/
	public append_directories(directories: readonly LintDirectoryFingerprint[]): void {
		for (const directory of directories) {
			this._hash.update(`${directory.directory}\u0000${directory.entries.join("\u0000")}\u0000`);
		}
	}

	/** Responsibilities: _final cache identity retrieval_. **/
	public value(): string {
		return this._hash.digest("hex");
	}
}
