import { RESPONSIBILITIES_PREFIX } from "src/constants";

/** Responsibilities: _responsibility documentation access_, _responsibility line lookup_. **/
export class ResponsibilityDocumentation {
	private readonly _lines: string[];

	/** Responsibilities: _documentation line cleanup_. **/
	private clean_line(line: string): string {
		let cleaned = line.trim();
		if (cleaned.startsWith("/**")) {
			cleaned = cleaned.slice(3);
		}
		if (cleaned.endsWith("**/")) {
			cleaned = cleaned.slice(0, -3);
		}
		if (cleaned.startsWith("*")) {
			cleaned = cleaned.slice(1);
		}
		return cleaned.trim();
	}

	/** Responsibilities: _documentation lines storage_. **/
	public constructor(documentation: string) {
		this._lines = documentation.split(/\r?\n/u).map((line) => this.clean_line(line));
	}

	/** Responsibilities: _responsibilities line presence_. **/
	public present(): boolean {
		return this._lines.some((line) => line.startsWith(RESPONSIBILITIES_PREFIX));
	}

	/** Responsibilities: _responsibilities line count_. **/
	public line_count(): number {
		return this._lines.filter((line) => line.startsWith(RESPONSIBILITIES_PREFIX)).length;
	}

	/** Responsibilities: _responsibilities line access_. **/
	public line(): string {
		const line = this._lines.find((item) => item.startsWith(RESPONSIBILITIES_PREFIX));
		if (line === undefined) {
			return "";
		}
		return line;
	}
}
