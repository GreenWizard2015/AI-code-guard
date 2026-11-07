import {
	REVIEW_FIELD_AFFECTED_PATHS,
	REVIEW_FIELD_EVIDENCE,
	REVIEW_FIELD_IMPACT,
	REVIEW_FIELD_INVARIANT,
	REVIEW_FIELD_REPRODUCTION,
	REVIEW_FIELD_REQUIRED_CORRECTION,
	REVIEW_FIELD_SEVERITY,
	REVIEW_FIELD_STATUS,
	REVIEW_FIELD_TASK,
	REVIEW_REQUIRED_FIELD_LABELS,
	REVIEW_SEVERITY_REQUIREMENT,
	REVIEW_SEVERITY_VALUES,
	REVIEW_STATUS_OPEN,
	REVIEW_STATUS_RESOLVED,
} from "src/core/support/task/review-agent/constants";

/** Responsibilities: _document structure_, _document status_. **/
export class ReviewFindingDocument {
	private readonly _text: string;

	/** Responsibilities: _section content_. **/
	private has_content_section(label: string): boolean {
		const lines = this.unfenced_lines();
		const heading = `${label}:`;
		const start = lines.findIndex((line) => line.trim() === heading);
		if (start < 0) {
			return this.has_value(label);
		}
		return this.has_section_content(lines, start, label === REVIEW_FIELD_AFFECTED_PATHS);
	}

	/** Responsibilities: _section values_. **/
	private has_section_content(lines: readonly string[], start: number, require_list_item: boolean): boolean {
		for (let index = start + 1; index < lines.length; index += 1) {
			const line = lines[index];
			if (line === undefined || line.trim().length === 0) {
				continue;
			}
			const value = line.trim();
			const heading_line = value.startsWith("#");
			const field_line = REVIEW_REQUIRED_FIELD_LABELS.some((field) => value.startsWith(`${field}:`));
			const section_ended = heading_line || field_line;
			if (section_ended) {
				return false;
			}
			return this.section_value_valid(value, require_list_item);
		}
		return false;
	}

	/** Responsibilities: _section item shape_. **/
	private section_value_valid(value: string, require_list_item: boolean): boolean {
		if (!require_list_item) {
			return true;
		}
		return value.startsWith("- ") && value.slice(2).trim().length > 0;
	}

	/** Responsibilities: _field values_. **/
	private has_value(label: string): boolean {
		const lines = this.unfenced_lines();
		const prefix = `${label}:`;
		return lines.some((line) => {
			const value = line.trim();
			return value.startsWith(prefix) && value.slice(prefix.length).trim().length > 0;
		});
	}

	/** Responsibilities: _severity category_. **/
	private has_valid_severity(): boolean {
		const prefix = `${REVIEW_FIELD_SEVERITY}:`;
		return this.unfenced_lines().some((line) => {
			const value = line.trim();
			return value.startsWith(prefix) && REVIEW_SEVERITY_VALUES.includes(value.slice(prefix.length).trim());
		});
	}

	/** Responsibilities: _header fields_. **/
	private missing_header_fields(): string[] {
		const missing: string[] = [];
		if (!this.has_valid_severity()) {
			missing.push(REVIEW_SEVERITY_REQUIREMENT);
		}
		if (this.status() === "") {
			missing.push(`${REVIEW_FIELD_STATUS} (use ${REVIEW_STATUS_OPEN} or ${REVIEW_STATUS_RESOLVED} exactly once)`);
		}
		if (!this.has_value(REVIEW_FIELD_TASK)) {
			missing.push(REVIEW_FIELD_TASK);
		}
		return missing;
	}

	/** Responsibilities: _evidence fields_. **/
	private missing_evidence_fields(): string[] {
		const missing: string[] = [];
		if (!this.has_value(REVIEW_FIELD_INVARIANT)) {
			missing.push(REVIEW_FIELD_INVARIANT);
		}
		if (!this.has_content_section(REVIEW_FIELD_AFFECTED_PATHS)) {
			missing.push(REVIEW_FIELD_AFFECTED_PATHS);
		}
		if (!this.has_content_section(REVIEW_FIELD_EVIDENCE)) {
			missing.push(REVIEW_FIELD_EVIDENCE);
		}
		if (!this.has_value(REVIEW_FIELD_REPRODUCTION)) {
			missing.push(REVIEW_FIELD_REPRODUCTION);
		}
		return missing;
	}

	/** Responsibilities: _impact fields_. **/
	private missing_correction_fields(): string[] {
		const missing: string[] = [];
		if (!this.has_value(REVIEW_FIELD_IMPACT)) {
			missing.push(REVIEW_FIELD_IMPACT);
		}
		if (!this.has_content_section(REVIEW_FIELD_REQUIRED_CORRECTION)) {
			missing.push(REVIEW_FIELD_REQUIRED_CORRECTION);
		}
		return missing;
	}

	/** Responsibilities: _code fences_. **/
	private unfenced_lines(): string[] {
		const lines: string[] = [];
		let fenced = false;
		for (const line of this._text.split(/\r?\n/u)) {
			if (/^```/u.test(line.trim())) {
				fenced = !fenced;
				continue;
			}
			if (!fenced) {
				lines.push(line);
			}
		}
		return lines;
	}

	/** Responsibilities: _document state_. **/
	public constructor(text: string) {
		this._text = text;
	}

	/** Responsibilities: _document lifecycle status_. **/
	public status(): string {
		let status = "";
		for (const line of this.unfenced_lines()) {
			const value = line.trim();
			if (!value.startsWith(`${REVIEW_FIELD_STATUS}:`)) {
				continue;
			}
			if (status.length > 0) {
				return "";
			}
			status = value;
		}
		if (status === REVIEW_STATUS_OPEN || status === REVIEW_STATUS_RESOLVED) {
			return status;
		}
		return "";
	}

	/** Responsibilities: _field schema_. **/
	public missing_fields(): string[] {
		const title = this.unfenced_lines().find((line) => line.trim().length > 0);
		const missing = [
			...this.missing_header_fields(),
			...this.missing_evidence_fields(),
			...this.missing_correction_fields(),
		];
		if (title === undefined || !title.trim().startsWith("# ")) {
			return ["title", ...missing];
		}
		return missing;
	}

	/** Responsibilities: _document line count_. **/
	public line_count(): number {
		if (this._text.length === 0) {
			return 1;
		}
		const content = this._text.trimEnd();
		if (content.length === 0) {
			return 1;
		}
		return content.split(/\r?\n/u).length;
	}
}
