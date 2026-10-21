import type { ViolationContract } from "src/reporting_protocols";
import type { ReportViolation } from "src/reporting_protocols";
import { ViolationValue } from "src/violation_value";

/** Responsibilities: _cache integrity validation_, _violation snapshot access_. **/
export class ViolationCache {
	private readonly source: readonly ReportViolation[];

	/** Responsibilities: _cache diagnostic validation_. **/
	private valid(value: ReportViolation): boolean {
		if (value === null || value === undefined || Array.isArray(value)) {
			return false;
		}
		const text_fields_valid = [value.file, value.message, value.hint, value.rule_id].every(
			(field) => String(field) === field,
		);
		const number_fields_valid = Number.isFinite(value.line) && Number.isFinite(value.priority);
		return text_fields_valid && number_fields_valid;
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
