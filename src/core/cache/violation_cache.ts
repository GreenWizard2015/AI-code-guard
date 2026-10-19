import type { ViolationContract } from "src/protocols";
import type { ReportViolation } from "src/types";
import { ViolationValue } from "src/violation_value";

/** Responsibilities: _cache integrity validation_, _violation snapshot access_. **/
export class ViolationCache {
	private readonly source: readonly ReportViolation[];

	/** Responsibilities: _cache text validation_. **/
	private text(value: string): boolean {
		if (value === null || value === undefined) {
			return false;
		}
		return value === String(value);
	}

	/** Responsibilities: _cache number validation_. **/
	private number(value: number): boolean {
		if (value === null || value === undefined) {
			return false;
		}
		return Number.isFinite(value);
	}

	/** Responsibilities: _cache diagnostic validation_. **/
	private valid(record: ReportViolation): boolean {
		if (!this.text(record.file)) {
			return false;
		}
		if (!this.number(record.line)) {
			return false;
		}
		if (!this.text(record.message)) {
			return false;
		}
		if (!this.text(record.hint)) {
			return false;
		}
		if (!this.text(record.rule_id)) {
			return false;
		}
		return this.number(record.priority);
	}

	/** Responsibilities: _cache diagnostic initialization_. **/
	public constructor(values: readonly ReportViolation[]) {
		this.source = values;
	}

	/** Responsibilities: _cache diagnostic validity_. **/
	public valid_cache(): boolean {
		if (!Array.isArray(this.source)) {
			return false;
		}
		for (const value of this.source) {
			if (!this.valid(value)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _cache diagnostic value conversion_. **/
	public values(): readonly ViolationContract[] {
		if (!this.valid_cache()) {
			return [];
		}
		return this.source.map((value) => new ViolationValue(value));
	}
}
