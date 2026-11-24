import type { LintDirectoryFingerprint, LintFileFingerprint } from "src/project_analysis_types";

/** Responsibilities: _file fingerprint validity_, _directory fingerprint validity_. **/
export class LintExecutionCacheFingerprintsSnapshot {
	private readonly _files: readonly LintFileFingerprint[];
	private readonly _directories: readonly LintDirectoryFingerprint[];

	/** Responsibilities: _cache file timestamp validation_. **/
	private file_times_valid(fingerprint: LintFileFingerprint): boolean {
		const size_valid = Number.isFinite(fingerprint.size);
		const modified_valid = Number.isFinite(fingerprint.mtime_ms);
		const changed_valid = Number.isFinite(fingerprint.ctime_ms);
		return size_valid && modified_valid && changed_valid;
	}

	/** Responsibilities: _cache file fingerprint validation_. **/
	private file_valid(fingerprint: LintFileFingerprint): boolean {
		if (fingerprint === null || typeof fingerprint !== "object") {
			return false;
		}
		if (typeof fingerprint.file !== "string" || typeof fingerprint.content_hash !== "string") {
			return false;
		}
		return this.file_times_valid(fingerprint);
	}

	/** Responsibilities: _cache directory fingerprint validation_. **/
	private directory_valid(fingerprint: LintDirectoryFingerprint): boolean {
		if (fingerprint === null || typeof fingerprint !== "object") {
			return false;
		}
		if (typeof fingerprint.directory !== "string" || !Array.isArray(fingerprint.entries)) {
			return false;
		}
		if (!fingerprint.entries.every((entry: unknown) => typeof entry === "string")) {
			return false;
		}
		const modified_valid = Number.isFinite(fingerprint.mtime_ms);
		const changed_valid = Number.isFinite(fingerprint.ctime_ms);
		return modified_valid && changed_valid;
	}

	/** Responsibilities: _cache fingerprint snapshot initialization_. **/
	public constructor(files: readonly LintFileFingerprint[], directories: readonly LintDirectoryFingerprint[]) {
		this._files = files;
		this._directories = directories;
	}

	/** Responsibilities: _file fingerprint validation_. **/
	public files_valid(): boolean {
		if (!Array.isArray(this._files)) {
			return false;
		}
		return this._files.every((fingerprint) => this.file_valid(fingerprint));
	}

	/** Responsibilities: _directory fingerprint validation_. **/
	public directories_valid(): boolean {
		if (!Array.isArray(this._directories)) {
			return false;
		}
		return this._directories.every((fingerprint) => this.directory_valid(fingerprint));
	}
}
