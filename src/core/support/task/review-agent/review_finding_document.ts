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
import type { ReviewFenceState } from "src/core/support/task/review-agent/types";

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
	private section_value_valid(section_text: string, require_list_item: boolean): boolean {
		if (!require_list_item) {
			return true;
		}
		return section_text.startsWith("- ") && section_text.slice(2).trim().length > 0;
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

	/** Responsibilities: _evidence fields_. **/
	private evidence_fields(missing: string[]): void {
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
	}

	/** Responsibilities: _correction fields_. **/
	private correction_fields(missing: string[]): void {
		if (!this.has_value(REVIEW_FIELD_IMPACT)) {
			missing.push(REVIEW_FIELD_IMPACT);
		}
		if (!this.has_content_section(REVIEW_FIELD_REQUIRED_CORRECTION)) {
			missing.push(REVIEW_FIELD_REQUIRED_CORRECTION);
		}
	}

	/** Responsibilities: _code fences_. **/
	private unfenced_lines(): string[] {
		const lines: string[] = [];
		let fence_state: ReviewFenceState = { character: "", length: 0, is_open: false };
		for (const line of this._text.split(/\r?\n/u)) {
			const value = line.trimStart();
			if (fence_state.is_open) {
				fence_state = this.close_fence_line(value, fence_state);
				continue;
			}
			fence_state = this.open_fence_line(value);
			if (fence_state.is_open) {
				continue;
			}
			lines.push(line);
		}
		return lines;
	}

	/** Responsibilities: _fence opener syntax_. **/
	private open_fence_line(line_text: string): ReviewFenceState {
		const fence = line_text.match(/^(`{3,}|~{3,})(.*)$/u);
		if (fence === null) {
			return { character: "", length: 0, is_open: false };
		}
		const delimiter = fence[1] ?? "";
		const info = fence[2] ?? "";
		if (delimiter[0] === "`" && info.includes("`")) {
			return { character: "", length: 0, is_open: false };
		}
		const character = delimiter[0] ?? "";
		return { character, length: delimiter.length, is_open: true };
	}

	/** Responsibilities: _fence closer syntax_. **/
	private close_fence_line(line_text: string, state: ReviewFenceState): ReviewFenceState {
		const closing = line_text.match(/^(`+|~+)[ \t]*$/u);
		if (closing === null) {
			return state;
		}
		const delimiter = closing[1] ?? "";
		if (delimiter[0] !== state.character || delimiter.length < state.length) {
			return state;
		}
		return { character: "", length: 0, is_open: false };
	}

	/** Responsibilities: _document header fields_. **/
	private header_fields(): string[] {
		const missing: string[] = [];
		const title = this.unfenced_lines().find((line) => line.trim().length > 0);
		if (title === undefined || !title.trim().startsWith("# ")) {
			missing.push("title");
		}
		if (!this.has_valid_severity()) {
			missing.push(REVIEW_SEVERITY_REQUIREMENT);
		}
		if (this.status() === "") {
			missing.push(`${REVIEW_FIELD_STATUS} (use ${REVIEW_STATUS_OPEN} or ${REVIEW_STATUS_RESOLVED} exactly once)`);
		}
		return missing;
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
		const missing = this.header_fields();
		if (!this.has_value(REVIEW_FIELD_TASK)) {
			missing.push(REVIEW_FIELD_TASK);
		}
		this.evidence_fields(missing);
		this.correction_fields(missing);
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
