import { createHash } from "node:crypto";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { MISSING_CACHE_VALUE } from "src/constants";
import { CACHE_INPUT_STABILITY_ATTEMPTS } from "src/core/constants";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { CacheState, LintFileFingerprint } from "src/project_analysis_types";

/** Responsibilities: _cache input identity_, _file fingerprint stability_. **/
export class LintCacheInputFile {
	private readonly _path: string;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;

	/** Responsibilities: _file metadata comparison_. **/
	private same_metadata(left: LintFileFingerprint, right: LintFileFingerprint): boolean {
		if (left.size !== right.size || left.mtime_ms !== right.mtime_ms) {
			return false;
		}
		return left.ctime_ms === right.ctime_ms;
	}

	/** Responsibilities: _in-memory snapshot consistency attempt_. **/
	private snapshot_attempt(source_text: string, content_hash: string): LintFileFingerprint {
		try {
			const before = this._file_io.file(this._path).metadata();
			const current_text = this._file_io.file(this._path).file_text();
			const after = this._file_io.file(this._path).metadata();
			const unchanged_metadata = this.same_metadata(
				{ file: this._path, ...before, content_hash },
				{ file: this._path, ...after, content_hash },
			);
			const unchanged_source = current_text.replace(/\r\n?/gu, "\n") === source_text.replace(/\r\n?/gu, "\n");
			if (unchanged_metadata && unchanged_source) {
				return { file: this._path, ...after, content_hash };
			}
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
		return { file: this._path, size: -1, mtime_ms: -1, ctime_ms: -1, content_hash };
	}

	/** Responsibilities: _disk content consistency attempt_. **/
	private disk_attempt(): LintFileFingerprint {
		try {
			const before = this._file_io.file(this._path).metadata();
			const current_text = this._file_io.file(this._path).file_text();
			const content_hash = createHash("sha256").update(current_text.replace(/\r\n?/gu, "\n")).digest("hex");
			const after = this._file_io.file(this._path).metadata();
			const before_fingerprint = { file: this._path, ...before, content_hash };
			const after_fingerprint = { file: this._path, ...after, content_hash };
			if (this.same_metadata(before_fingerprint, after_fingerprint)) {
				return after_fingerprint;
			}
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
		return { file: this._path, size: -1, mtime_ms: -1, ctime_ms: -1, content_hash: MISSING_CACHE_VALUE };
	}

	/** Responsibilities: _current ignore-file fingerprint_. **/
	private current_ignore_fingerprint(): CacheState<LintFileFingerprint> {
		try {
			const metadata = this._file_io.file(this._path).metadata();
			const text = this._file_io.file(this._path).file_text();
			const content_hash = createHash("sha256").update(text.replace(/\r\n?/gu, "\n")).digest("hex");
			return { available: true, value: { file: this._path, ...metadata, content_hash } };
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return this.missing_ignore_fingerprint(String(error));
		}
	}

	/** Responsibilities: _missing ignore-file fingerprint_. **/
	private missing_ignore_fingerprint(message: string): CacheState<LintFileFingerprint> {
		const fingerprint: LintFileFingerprint = {
			file: this._path,
			size: -1,
			mtime_ms: -1,
			ctime_ms: -1,
			content_hash: "",
		};
		if (!message.includes("ENOENT") && !message.includes("ENOTDIR")) {
			return { available: false, value: fingerprint };
		}
		return { available: true, value: { ...fingerprint, content_hash: MISSING_CACHE_VALUE } };
	}

	/** Responsibilities: _ignore-file fingerprint equality_. **/
	private same_ignore_fingerprint(previous: LintFileFingerprint, current: LintFileFingerprint): boolean {
		if (previous.size < 0 || current.size < 0) {
			return previous.size === current.size && previous.content_hash === current.content_hash;
		}
		if (current.size !== previous.size) {
			return false;
		}
		if (current.mtime_ms !== previous.mtime_ms || current.ctime_ms !== previous.ctime_ms) {
			return false;
		}
		return current.content_hash === previous.content_hash;
	}

	/** Responsibilities: _file IOContract ownership_. **/
	public constructor(path: string, file_io: IOContract) {
		this._path = path;
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
	}

	/** Responsibilities: _stable snapshot fingerprint_. **/
	public snapshot_fingerprint(source_text: string): LintFileFingerprint {
		const content_hash = createHash("sha256").update(source_text.replace(/\r\n?/gu, "\n")).digest("hex");
		let fingerprint: LintFileFingerprint = {
			file: this._path,
			size: -1,
			mtime_ms: -1,
			ctime_ms: -1,
			content_hash,
		};
		for (let attempt = 0; attempt < CACHE_INPUT_STABILITY_ATTEMPTS; attempt += 1) {
			fingerprint = this.snapshot_attempt(source_text, content_hash);
			if (fingerprint.size >= 0) {
				return fingerprint;
			}
		}
		return fingerprint;
	}

	/** Responsibilities: _stable disk fingerprint_. **/
	public disk_fingerprint(): LintFileFingerprint {
		let fingerprint: LintFileFingerprint = {
			file: this._path,
			size: -1,
			mtime_ms: -1,
			ctime_ms: -1,
			content_hash: MISSING_CACHE_VALUE,
		};
		for (let attempt = 0; attempt < CACHE_INPUT_STABILITY_ATTEMPTS; attempt += 1) {
			fingerprint = this.disk_attempt();
			if (fingerprint.size >= 0) {
				return fingerprint;
			}
		}
		return fingerprint;
	}

	/** Responsibilities: _ignore-file cache validation_. **/
	public ignore_file_matches(previous: LintFileFingerprint): boolean {
		const state = this.current_ignore_fingerprint();
		if (!state.available) {
			return false;
		}
		return this.same_ignore_fingerprint(previous, state.value);
	}
}
