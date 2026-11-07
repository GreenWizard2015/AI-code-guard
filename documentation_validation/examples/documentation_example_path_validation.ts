import { normalize } from "node:path";
import { DocumentationExampleSourcePath } from "documentation_validation/examples/documentation_example_source_path";
import { DocumentationLanguage } from "documentation_validation/types";
import type { DocumentationExample, DocumentationExampleSourceFiles } from "documentation_validation/types";

/** Responsibilities: _example source path integrity_, _file declaration ordering_. **/
export class DocumentationExamplePathValidation {
	private readonly _example: DocumentationExample;

	/** Responsibilities: _analysis path validation_. **/
	private append_analysis_path(issues: string[], seen: ReadonlySet<string>, analysis_path: string): void {
		if (seen.has(analysis_path)) {
			return;
		}
		issues.push(`${analysis_path} must match a File: entry in this Markdown block`);
	}

	/** Responsibilities: _language-specific CLI filename_. **/
	private required_entry(): string {
		if (this._example.language === DocumentationLanguage.PYTHON) {
			return "cli.py";
		}
		return "cli.ts";
	}

	/** Responsibilities: _declared CLI file lookup_. **/
	private declared_cli_file(files: DocumentationExampleSourceFiles): string {
		for (const file of files) {
			const source_path = new DocumentationExampleSourcePath(file.path);
			if (source_path.cli_file()) {
				return file.path;
			}
		}
		return "";
	}

	/** Responsibilities: _misplaced CLI file diagnostic_. **/
	private misplaced_cli_issue(files: DocumentationExampleSourceFiles): readonly string[] {
		const declared_file = this.declared_cli_file(files);
		if (declared_file.length > 0) {
			return [`${declared_file} must be the last File: entry in its Markdown block`];
		}
		return [`${this.required_entry()} must be declared as the final File: entry`];
	}

	/** Responsibilities: _path validation dependency ownership_. **/
	public constructor(example: DocumentationExample) {
		this._example = example;
	}

	/** Responsibilities: _CLI declaration ordering_. **/
	public cli_order_issues(): readonly string[] {
		const files = this._example.source_files;
		const last_file = files.at(-1);
		if (last_file === undefined) {
			return [`${this.required_entry()} must be declared as the final File: entry`];
		}
		const last_source_path = new DocumentationExampleSourcePath(last_file.path);
		if (last_source_path.cli_file()) {
			return [];
		}
		return this.misplaced_cli_issue(files);
	}

	/** Responsibilities: _source path uniqueness_, _analysis path membership_. **/
	public source_path_issues(analysis_path: string): readonly string[] {
		const issues: string[] = [];
		const seen = new Set<string>();
		for (const file of this._example.source_files) {
			const source_path = new DocumentationExampleSourcePath(file.path);
			source_path.append_issues(issues, seen);
		}
		if (issues.length > 0) {
			return issues;
		}
		if (this._example.source_files.length > 0) {
			const normalized_analysis_path = normalize(analysis_path).replaceAll("\\", "/");
			this.append_analysis_path(issues, seen, normalized_analysis_path);
		}
		return issues;
	}
}
