import { isAbsolute, normalize, win32 } from "node:path";
import type { DocumentationExample } from "documentation_validation/types";

/** Responsibilities: _example source path integrity_, _file declaration ordering_. **/
export class DocumentationExamplePathValidation {
	private readonly example: DocumentationExample;

	/** Responsibilities: _CLI path classification_. **/
	private cli_file(path: string): boolean {
		const segments = path.split("/");
		const file_name = segments[segments.length - 1];
		return file_name === "cli.ts" || file_name === "cli.py";
	}

	/** Responsibilities: _relative source path validation_. **/
	private invalid_path(path: string): boolean {
		if (path.length === 0) {
			return true;
		}
		if (path.includes("\\")) {
			return true;
		}
		if (isAbsolute(path) || win32.isAbsolute(path)) {
			return true;
		}
		return path.split(/[\\/]/u).includes("..");
	}

	/** Responsibilities: _analysis path validation_. **/
	private append_analysis_path(issues: string[], seen: ReadonlySet<string>, analysis_path: string): void {
		if (seen.has(analysis_path)) {
			return;
		}
		issues.push(`${analysis_path} must match a File: entry in this Markdown block`);
	}

	/** Responsibilities: _source path uniqueness_. **/
	private append_file_issues(issues: string[], seen: Set<string>, path: string): void {
		const normalized_path = normalize(path).replaceAll("\\", "/");
		if (this.invalid_path(path)) {
			issues.push(`${path} must be a relative path inside the example project`);
			return;
		}
		if (seen.has(normalized_path)) {
			issues.push(`${path} is declared more than once in this Markdown block`);
			return;
		}
		seen.add(normalized_path);
	}

	/** Responsibilities: _path validation result initialization_. **/
	public constructor(example: DocumentationExample) {
		this.example = example;
	}

	/** Responsibilities: _CLI declaration ordering_. **/
	public cli_order_issues(): readonly string[] {
		const files = this.example.source_files;
		const last_file = files[files.length - 1];
		if (last_file === undefined) {
			return [];
		}
		if (this.cli_file(last_file.path)) {
			return [];
		}
		for (const file of files) {
			if (this.cli_file(file.path)) {
				return [`${file.path} must be the last File: entry in its Markdown block`];
			}
		}
		return [];
	}

	/** Responsibilities: _source path uniqueness_, _analysis path membership_. **/
	public source_path_issues(analysis_path: string): readonly string[] {
		const issues: string[] = [];
		const seen = new Set<string>();
		for (const file of this.example.source_files) {
			this.append_file_issues(issues, seen, file.path);
		}
		if (issues.length > 0) {
			return issues;
		}
		if (this.example.source_files.length > 0) {
			const normalized_analysis_path = normalize(analysis_path).replaceAll("\\", "/");
			this.append_analysis_path(issues, seen, normalized_analysis_path);
		}
		return issues;
	}
}
