import type { LintExecutionCacheRecordSnapshotContract } from "src/cache_protocols";
import { LintExecutionCacheFingerprintsSnapshot } from "src/core/cache/lint_execution/snapshots/lint_execution_cache_fingerprints_snapshot";
import { ViolationCache } from "src/core/cache/violation_cache";
import type {
	LintDirectoryFingerprint,
	LintExecutionCacheRecord,
	LintFileFingerprint,
	LintInputFiles,
} from "src/project_analysis_types";
import type { TestTargetLink } from "src/task_types";

/** Responsibilities: _cache record snapshot_, _cache record validity_. **/
export class LintExecutionCacheRecordSnapshot implements LintExecutionCacheRecordSnapshotContract {
	private readonly _record: LintExecutionCacheRecord;
	private readonly _fingerprints: LintExecutionCacheFingerprintsSnapshot;

	/** Responsibilities: _cache text field validation_. **/
	private text(value: string): boolean {
		if (value === null) {
			return false;
		}
		if (value === undefined) {
			return false;
		}
		return typeof value === "string";
	}

	/** Responsibilities: _cache finite number validation_. **/
	private finite(value: number): boolean {
		if (value === null) {
			return false;
		}
		if (value === undefined) {
			return false;
		}
		return typeof value === "number" && Number.isFinite(value);
	}

	/** Responsibilities: _cache string collection validation_. **/
	private strings(value: readonly string[]): boolean {
		if (!Array.isArray(value)) {
			return false;
		}
		return value.every((item) => this.text(item));
	}

	/** Responsibilities: _unique cache path validation_. **/
	private unique_strings(value: readonly string[]): boolean {
		const unique_values = new Set<string>();
		for (const item of value) {
			unique_values.add(item);
		}
		return unique_values.size === value.length;
	}

	/** Responsibilities: _cache diagnostic validation_. **/
	/** Responsibilities: _cache record collection validation_. **/
	private record_arrays_valid(): boolean {
		if (!this.strings(this._record.entry_files)) {
			return false;
		}
		if (!this.strings(this._record.ignored_directories)) {
			return false;
		}
		if (!this.result_valid()) {
			return false;
		}
		if (!this._fingerprints.files_valid()) {
			return false;
		}
		return this._fingerprints.directories_valid();
	}

	/** Responsibilities: _cached execution result validation_. **/
	private result_valid(): boolean {
		const result = this._record.result;
		if (result === null || typeof result !== "object" || Array.isArray(result)) {
			return false;
		}
		if (!this.strings(result.files) || !this.unique_strings(result.files)) {
			return false;
		}
		const diagnostics = new ViolationCache(result.violations);
		if (!diagnostics.valid_cache()) {
			return false;
		}
		return this.links_valid(result.test_target_links);
	}

	/** Responsibilities: _agent link fields_. **/
	private links_valid(links: readonly TestTargetLink[]): boolean {
		if (!Array.isArray(links)) {
			return false;
		}
		for (const link of links) {
			if (link === null || typeof link !== "object" || typeof link.test_file !== "string") {
				return false;
			}
			if (!this.strings(link.production_files)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _cache input collection_. **/
	private source_inputs_valid(inputs: LintInputFiles): boolean {
		if (!this.strings(inputs.files) || !this.unique_strings(inputs.files)) {
			return false;
		}
		if (!this.strings(inputs.project_files) || !this.unique_strings(inputs.project_files)) {
			return false;
		}
		if (!this.strings(inputs.ignored_files)) {
			return false;
		}
		return this.unique_strings(inputs.ignored_files);
	}

	/** Responsibilities: _cache metadata input collection_. **/
	private metadata_inputs_valid(inputs: LintInputFiles): boolean {
		if (!this.strings(inputs.markdown_files) || !this.unique_strings(inputs.markdown_files)) {
			return false;
		}
		if (!this.strings(inputs.ignore_files)) {
			return false;
		}
		return this.unique_strings(inputs.ignore_files);
	}

	/** Responsibilities: _cache input collection_. **/
	private input_arrays_valid(): boolean {
		const inputs = this._record.inputs;
		if (inputs === null || inputs === undefined) {
			return false;
		}
		return this.source_inputs_valid(inputs) && this.metadata_inputs_valid(inputs);
	}

	/** Responsibilities: _cache record snapshot initialization_. **/
	public constructor(record: LintExecutionCacheRecord) {
		this._record = record;
		let fingerprints: LintFileFingerprint[] = [];
		let directories: LintDirectoryFingerprint[] = [];
		if (record !== null) {
			if (typeof record === "object") {
				if (!Array.isArray(record)) {
					fingerprints = record.fingerprints;
					directories = record.directories;
				}
			}
		}
		this._fingerprints = new LintExecutionCacheFingerprintsSnapshot(fingerprints, directories);
	}

	/** Responsibilities: _cache record validation_. **/
	public valid(): boolean {
		if (this._record === null) {
			return false;
		}
		if (!this.finite(this._record.cache_version)) {
			return false;
		}
		if (!this.text(this._record.identity)) {
			return false;
		}
		if (!this.text(this._record.target_request)) {
			return false;
		}
		if (!this.record_arrays_valid()) {
			return false;
		}
		return this.input_arrays_valid();
	}

	/** Responsibilities: _cache identity matching_. **/
	public identity_matches(identity: string): boolean {
		return this._record.identity === identity;
	}
}
