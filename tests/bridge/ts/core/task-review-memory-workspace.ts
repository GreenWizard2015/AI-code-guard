import { join } from "node:path";
import { CliApplication } from "src/core/cli_application";
import type { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { CliOptions } from "src/task_types";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _CLI virtual project state_, _in-memory report access_. **/
export class TaskReviewMemoryWorkspace {
	public readonly _root: string;
	public readonly _io: InMemoryFileIO;
	public readonly _source_texts: Map<string, string>;
	public readonly _source_io: InMemoryProjectSourceIO;

	/** Responsibilities: _virtual CLI workspace state_. **/
	public constructor(
		root: string,
		io: InMemoryFileIO,
		source_texts: Map<string, string>,
		source_io: InMemoryProjectSourceIO,
	) {
		this._root = root;
		this._io = io;
		this._source_texts = source_texts;
		this._source_io = source_io;
	}

	/** Responsibilities: _CLI application access_. **/
	public cli(): CliApplication {
		return new CliApplication(this._io, this._source_io);
	}

	/** Responsibilities: _lint stage timing_. **/
	public stage_timer(): LintStageTimer {
		return new LintStageTimer();
	}

	/** Responsibilities: _in-memory report retrieval_. **/
	public report(): string {
		return this._io.file(join(this._root, ".ai-code-guard", "report.md")).file_text();
	}

	/** Responsibilities: _virtual CLI execution_. **/
	public run_cli(arguments_list: string[]): ReturnType<CliApplication["run_cli"]> {
		return this.cli().run_cli(["node", "cli.ts", ...arguments_list]);
	}

	/** Responsibilities: _CLI option values_. **/
	public cli_options(
		skip_review: boolean,
		force_review: boolean,
		review_agent: CliOptions["review_agent"],
	): CliOptions {
		return {
			root: this._root,
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
