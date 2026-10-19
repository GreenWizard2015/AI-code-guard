import type {
	LintDirectoryFingerprint,
	LintExecutionCacheRecord,
	LintFileFingerprint,
} from "src/types";
import type { LintExecutionCacheRecordSnapshotContract } from "src/protocols";
import { ViolationCache } from "src/core/cache/violation_cache";

/** Responsibilities: _cache record snapshot_, _cache record validity_. **/
export class LintExecutionCacheRecordSnapshot implements LintExecutionCacheRecordSnapshotContract {
	private readonly record: LintExecutionCacheRecord;

	/** Responsibilities: _cache text field validation_. **/
	private text(value: string): boolean {
		if (value === null) {
			return false;
		}
		if (value === undefined) {
			return false;
		}
		return value === String(value);
	}

	/** Responsibilities: _cache finite number validation_. **/
	private finite(value: number): boolean {
		if (value === null) {
			return false;
		}
		if (value === undefined) {
			return false;
		}
		return Number.isFinite(value);
	}

	/** Responsibilities: _cache string collection validation_. **/
	private strings(value: readonly string[]): boolean {
		if (!Array.isArray(value)) {
			return false;
		}
		return value.every((item) => this.text(item));
	}

	/** Responsibilities: _cache diagnostic validation_. **/
	/** Responsibilities: _file fingerprint fields_. **/
	private file_fingerprint_texts(value: LintFileFingerprint): boolean {
		if (!this.text(value.file)) {
			return false;
		}
		return this.text(value.content_hash);
	}

	/** Responsibilities: _cache file fingerprint validation_. **/
	private file_fingerprint(value: LintFileFingerprint): boolean {
		if (value === null) {
			return false;
		}
		if (value === undefined) {
			return false;
		}
		if (!this.file_fingerprint_texts(value)) {
			return false;
		}
		if (!this.finite(value.size)) {
			return false;
		}
		if (!this.finite(value.mtime_ms)) {
			return false;
		}
		return this.finite(value.ctime_ms);
	}

	/** Responsibilities: _cache directory fingerprint validation_. **/
	private directory_fingerprint(value: LintDirectoryFingerprint): boolean {
		if (value === null) {
			return false;
		}
		if (value === undefined) {
			return false;
		}
		if (!this.text(value.directory)) {
			return false;
		}
		if (!this.strings(value.entries)) {
			return false;
		}
		if (!this.finite(value.mtime_ms)) {
			return false;
		}
		return this.finite(value.ctime_ms);
	}

	/** Responsibilities: _file fingerprint collection_. **/
	private fingerprints_valid(): boolean {
		if (!Array.isArray(this.record.fingerprints)) {
			return false;
		}
		return this.record.fingerprints.every((item) => this.file_fingerprint(item));
	}

	/** Responsibilities: _directory fingerprint collection_. **/
	private directories_valid(): boolean {
		if (!Array.isArray(this.record.directories)) {
			return false;
		}
		return this.record.directories.every((item) => this.directory_fingerprint(item));
	}

	/** Responsibilities: _cache record collection validation_. **/
	private record_arrays_valid(): boolean {
		if (!this.strings(this.record.entry_files)) {
			return false;
		}
		if (!this.strings(this.record.files)) {
			return false;
		}
		if (!this.strings(this.record.ignored_directories)) {
			return false;
		}
		const cache = new ViolationCache(this.record.violations);
		if (!cache.valid_cache()) {
			return false;
		}
		if (!this.fingerprints_valid()) {
			return false;
		}
		return this.directories_valid();
	}

	/** Responsibilities: _cache input collection_. **/
	private input_arrays_valid(): boolean {
		const inputs = this.record.inputs;
		if (inputs === null || inputs === undefined) {
			return false;
		}
		const source_inputs = this.strings(inputs.files) && this.strings(inputs.project_files) && this.strings(inputs.ignored_files);
		const metadata_inputs = this.strings(inputs.markdown_files) && this.strings(inputs.ignore_files);
		return source_inputs && metadata_inputs;
	}

	/** Responsibilities: _cache record snapshot initialization_. **/
	public constructor(record: LintExecutionCacheRecord) {
		this.record = record;
	}

	/** Responsibilities: _cache record validation_. **/
	public valid(): boolean {
		if (this.record === null) {
			return false;
		}
		if (!this.finite(this.record.cache_version)) {
			return false;
		}
		if (!this.text(this.record.identity)) {
			return false;
		}
		if (!this.text(this.record.target_request)) {
			return false;
		}
		if (!this.record_arrays_valid()) {
			return false;
		}
		return this.input_arrays_valid();
	}

	/** Responsibilities: _cache identity matching_. **/
	public identity_matches(identity: string): boolean {
		return this.record.identity === identity;
	}
}
