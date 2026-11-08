import { randomUUID } from "node:crypto";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { GlobalAnalysisCacheWriterIdentity } from "src/core/cache/types";
import type { FileResourceContract, IOContract } from "src/io/protocols";
import type { AstCacheRecord } from "src/model_types";

/** Responsibilities: _temporary file lifecycle_, _cache record persistence_. **/
export class AstDiskCacheTemporaryFiles {
	private readonly _file_io: IOContract;
	private readonly _failure_classification: SystemFailureClassificationContract;
	private readonly _temporary_write_paths: Set<string>;

	/** Responsibilities: _temporary record deletion_. **/
	private clean_temporary_record(temporary_file: FileResourceContract, only_missing_file: boolean): void {
		if (!temporary_file.path_exists()) {
			return;
		}
		try {
			temporary_file.remove_file();
		} catch (error) {
			const message = String(error);
			if (!this._failure_classification.check(message, BoundaryFailureCategory.System)) {
				throw error;
			}
			if (only_missing_file && !message.includes("ENOENT")) {
				throw error;
			}
		}
	}

	/** Responsibilities: _temporary writer identity_. **/
	private writer_entry(entry_name: string): GlobalAnalysisCacheWriterIdentity {
		const match = /\.json\.(\d+)(?:\.[0-9a-f-]{36})?\.tmp$/u.exec(entry_name);
		if (match === null) {
			return { recognized: false, process_id: 0 };
		}
		const process_id = Number(match[1]);
		if (!Number.isSafeInteger(process_id) || process_id < 1) {
			return { recognized: false, process_id: 0 };
		}
		return { recognized: true, process_id };
	}

	/** Responsibilities: _temporary writer activity_. **/
	private writer_active(process_id: number): boolean {
		try {
			process.kill(process_id, 0);
			return true;
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.MissingProcess)) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _temporary file lifecycle_. **/
	public constructor(
		file_io: IOContract,
		failure_classification: SystemFailureClassificationContract,
		temporary_write_paths: Set<string>,
	) {
		this._file_io = file_io;
		this._failure_classification = failure_classification;
		this._temporary_write_paths = temporary_write_paths;
	}

	/** Responsibilities: _abandoned writer cleanup_. **/
	public remove_abandoned(temporary_file: FileResourceContract, entry_name: string): void {
		const writer = this.writer_entry(entry_name);
		if (!writer.recognized || this._temporary_write_paths.has(temporary_file.path())) {
			return;
		}
		if (!this.writer_active(writer.process_id)) {
			this.clean_temporary_record(temporary_file, true);
		}
	}

	/** Responsibilities: _cache record persistence_. **/
	public persist(record_path: string, record: AstCacheRecord): void {
		const temporary_file = this._file_io.file(`${record_path}.${process.pid}.${randomUUID()}.tmp`);
		const temporary_path = temporary_file.path();
		const serialized = JSON.stringify(record);
		this._temporary_write_paths.add(temporary_path);
		try {
			temporary_file.write_text(serialized);
			temporary_file.move_to(this._file_io.file(record_path));
		} finally {
			this.clean_temporary_record(temporary_file, false);
			this._temporary_write_paths.delete(temporary_path);
		}
	}
}
