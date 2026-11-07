import { isAbsolute, normalize, win32 } from "node:path";

/** Responsibilities: _example source path validation_, _CLI file recognition_. **/
export class DocumentationExampleSourcePath {
	private readonly _value: string;

	/** Responsibilities: _relative path validation_. **/
	private valid(): boolean {
		if (this._value.length === 0 || this._value.includes("\\")) {
			return false;
		}
		if (isAbsolute(this._value) || win32.isAbsolute(this._value)) {
			return false;
		}
		return !this._value.split(/[\\/]/u).includes("..");
	}

	/** Responsibilities: _source path initialization_. **/
	public constructor(value: string) {
		this._value = value;
	}

	/** Responsibilities: _CLI file recognition_. **/
	public cli_file(): boolean {
		const segments = this._value.split("/");
		const file_name = segments.at(-1);
		return file_name === "cli.ts" || file_name === "cli.py";
	}

	/** Responsibilities: _source path issue collection_. **/
	public append_issues(issues: string[], seen: Set<string>): void {
		const normalized_path = normalize(this._value).replaceAll("\\", "/");
		if (!this.valid()) {
			issues.push(`${this._value} must be a relative path inside the example project`);
			return;
		}
		if (seen.has(normalized_path)) {
			issues.push(`${this._value} is declared more than once in this Markdown block`);
			return;
		}
		seen.add(normalized_path);
	}
}
