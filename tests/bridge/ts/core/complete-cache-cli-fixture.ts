import { LintRunConfiguration } from "src/core/lint_run_configuration";
import type { UnusedCode } from "src/core/project-source/unused_code";
import type { ProjectLintExecutionOptions } from "src/core/types";
import type { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

/** Responsibilities: _cache CLI execution_, _worker lifecycle_. **/
export class CompleteCacheCliFixture {
	private readonly _project_fixture: CompleteCacheFixture;
	private readonly _configuration: LintRunConfiguration;

	/** Responsibilities: _CLI test environment initialization_. **/
	public constructor() {
		this._project_fixture = new CompleteCacheFixture(new InMemoryFileIO());
		this._configuration = new LintRunConfiguration(this._project_fixture._source_io, this._project_fixture._file_io);
	}

	/** Responsibilities: _execution dependency assembly_. **/
	public execution_options(stage_timer: LintStageTimer, unused_code: UnusedCode): ProjectLintExecutionOptions {
		return {
			file_io: this._project_fixture._file_io,
			source_io: this._project_fixture._source_io,
			analysis_identity: this._project_fixture._analysis_identity,
			options: this._project_fixture._options,
			unused_code,
			stage_timer,
			lint_run_factory: this._configuration,
		};
	}

	/** Responsibilities: _worker environment cleanup_. **/
	public async close(): Promise<void> {
		await this._configuration.close_worker_session();
	}

	/** Responsibilities: _diagnostic result signatures_. **/
	public diagnostic_signatures(violations: readonly ViolationContract[]): string {
		return JSON.stringify(
			violations.map((item) => [
				item.file(),
				item.line(),
				item.message(),
				item.hint(),
				item.rule_id(),
				item.priority(),
			]),
		);
	}
}
