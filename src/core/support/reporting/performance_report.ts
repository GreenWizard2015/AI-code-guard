import { TWO_COLUMN_MARKDOWN_DIVIDER } from "src/constants";
import type { PerformanceReportOptions } from "src/model_types";
import type { LintStageDuration } from "src/runtime_types";

/** Responsibilities: _performance document formatting_, _language file counts_. **/
export class PerformanceReport {
	private readonly _root: string;
	private readonly _files: readonly string[];
	private readonly _durations: readonly LintStageDuration[];

	/** Responsibilities: _initialization performance report_. **/
	public constructor(options: PerformanceReportOptions) {
		this._root = options.root;
		this._files = options.files;
		this._durations = options.durations;
	}

	/** Responsibilities: _reporting source file counts_. **/
	public file_summary(): string {
		const typescript_files = this._files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx")).length;
		const python_files = this._files.filter((file) => file.endsWith(".py")).length;
		const lines = [
			`- TypeScript files: ${typescript_files}`,
			`- Python files: ${python_files}`,
			`- Total files: ${this._files.length}`,
		];
		return lines.join("\n");
	}

	/** Responsibilities: _rendering complete performance document_. **/
	public markdown(): string {
		const root_durations = this._durations.filter((stage) => !stage.name.includes("."));
		const total_duration = root_durations.reduce((total, stage) => total + stage.duration_ms, 0);
		const rows = this._durations.map((stage) => `| ${stage.name} | ${(stage.duration_ms / 1000).toFixed(3)} sec |`);
		rows.push(`| Total measured stages | ${(total_duration / 1000).toFixed(3)} sec |`);
		const lines = [
			"# Linter performance",
			"",
			`- Project root: \`${this._root}\``,
			this.file_summary(),
			"",
			"| Stage | Duration |",
			TWO_COLUMN_MARKDOWN_DIVIDER,
			...rows,
			"",
		];
		return lines.join("\n");
	}
}
