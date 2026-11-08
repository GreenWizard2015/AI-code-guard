import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";
import type { ReportViolationOptions } from "src/reporting_protocols";

/** Responsibilities: _cache integrity validation_, _violation snapshot access_. **/
export class ViolationCache {
	private readonly _source: readonly ReportViolationOptions[];

	/** Responsibilities: _cache diagnostic validation_. **/
	private valid(value: ReportViolationOptions): boolean {
		if (value === null || value === undefined || Array.isArray(value)) {
			return false;
		}
		const text_fields_valid = [value.file, value.message, value.hint, value.rule_id].every(
			(field) => typeof field === "string",
		);
		const line_valid = typeof value.line === "number" && Number.isInteger(value.line) && value.line >= 0;
		const number_fields_valid = line_valid && typeof value.priority === "number" && Number.isFinite(value.priority);
		if (!text_fields_valid) {
			return false;
		}
		if (!number_fields_valid) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _cache diagnostic initialization_. **/
	public constructor(values: readonly ReportViolationOptions[]) {
		this._source = values;
	}

	/** Responsibilities: _cache diagnostic validity_. **/
	public valid_cache(): boolean {
		if (!Array.isArray(this._source)) {
			return false;
		}
		for (const value of this._source) {
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
		return this._source.map((value) => new ViolationValue(value));
	}
}
