import type {
	CallableDocumentationValidationOperation,
	DocumentationExampleLintContract,
	DocumentationExampleSourceFiles,
} from "documentation_validation/types";
import { RULE_DATA } from "src/constants";
import { DocumentationExampleRun } from "src/core/support/documentation_example_run";
import type {
	DocumentationExampleLintConfigurationContract,
	DocumentationExampleRunOptions,
} from "src/core/support/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { WorkerSessionProviderContract } from "src/runtime_protocols";

/** Responsibilities: _documentation validation lifecycle_, _rule catalog synchronization_. **/
export class DocumentationValidationSession implements DocumentationExampleLintContract {
	private readonly _configuration: DocumentationExampleLintConfigurationContract;
	private readonly _worker_sessions: WorkerSessionProviderContract;

	/** Responsibilities: _lint configuration ownership_. **/
	public constructor(
		configuration: DocumentationExampleLintConfigurationContract,
		worker_sessions: WorkerSessionProviderContract,
	) {
		this._configuration = configuration;
		this._worker_sessions = worker_sessions;
	}

	/** Responsibilities: _documentation example diagnostics_. **/
	public lint(
		repo_root: string,
		source_path: string,
		rule_id: string,
		source_files: DocumentationExampleSourceFiles,
	): readonly ViolationContract[] {
		const options: DocumentationExampleRunOptions = {
			repo_root,
			source_path,
			rule_id,
			source_files,
			configuration: this._configuration,
		};
		const run = new DocumentationExampleRun(options);
		run.validate_paths();
		return run.violations();
	}

	/** Responsibilities: _rule catalog synchronization_. **/
	public rule_ids(): readonly string[] {
		return Object.keys(RULE_DATA);
	}

	/** Responsibilities: _validation session lifecycle_. **/
	public async with_worker<T>(operation: CallableDocumentationValidationOperation<T>): Promise<T> {
		try {
			return await operation();
		} finally {
			await this._worker_sessions.close_worker_session();
		}
	}
}
