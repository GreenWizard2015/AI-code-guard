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
		const number_fields_valid =
			typeof value.line === "number" &&
			typeof value.priority === "number" &&
			Number.isFinite(value.line) &&
			Number.isFinite(value.priority);
		return text_fields_valid && number_fields_valid;
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
