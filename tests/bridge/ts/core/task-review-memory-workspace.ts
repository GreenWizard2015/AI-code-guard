import { join } from "node:path";
import { CliApplication } from "src/core/cli_application";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { CliOptions } from "src/types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _CLI virtual project state_, _in-memory report access_. **/
export class TaskReviewMemoryWorkspace {
	public readonly root: string;
	public readonly io: InMemoryFileIO;
	public readonly source_texts: Map<string, string>;
	public readonly source_io: InMemoryProjectSourceIO;

	/** Responsibilities: _virtual CLI workspace state_. **/
	public constructor(
		root: string,
		io: InMemoryFileIO,
		source_texts: Map<string, string>,
		source_io: InMemoryProjectSourceIO,
	) {
		this.root = root;
		this.io = io;
		this.source_texts = source_texts;
		this.source_io = source_io;
	}

	/** Responsibilities: _CLI application access_. **/
	public cli(): CliApplication {
		return new CliApplication(this.io, this.source_io);
	}

	/** Responsibilities: _lint stage timing_. **/
	public stage_timer(): LintStageTimer {
		return new LintStageTimer();
	}

	/** Responsibilities: _in-memory report retrieval_. **/
	public report(): string {
		return this.io.file_content.file_text(join(this.root, ".ai-code-guard", "report.md"));
	}

	/** Responsibilities: _CLI argument preservation_. **/
	public async run_cli(arguments_list: string[]): Promise<void> {
		const previous_arguments = process.argv;
		process.argv = ["node", "cli.ts", ...arguments_list];
		try {
			await this.cli().run_cli();
		} finally {
			process.argv = previous_arguments;
		}
	}

	/** Responsibilities: _CLI option values_. **/
	public cli_options(
		skip_review: boolean,
		force_review: boolean,
		review_agent: CliOptions["review_agent"],
	): CliOptions {
		return {
			root: this.root,
			ignored_directories: [],
			entry_files: [],
			skip_review,
			force_review,
			review_cleanup: false,
			review_agent,
			review_stages: [],
			batch_size: 10,
			policy: "all",
		};
	}
}
