import { TextFileDiscovery } from "src/core/discovery/text_file_discovery";
import { LintRunAnalysis } from "src/core/lint-analysis/lint_run_analysis";
import { LintInputFileSelector } from "src/core/lint_input_file_selector";
import { LintRunWorkerLifecycle } from "src/core/lint_run_worker_lifecycle";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";
import type { LintRunConfigurationAssemblyContract, LintRunConfigurationAssemblyResult } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type { LintRunWorkerLifecycleContract, ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _lint analysis services_, _worker lifecycle composition_. **/
export class LintRunConfigurationAssembly implements LintRunConfigurationAssemblyContract {
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _file_io: IOContract;

	/** Responsibilities: _worker lifecycle composition_. **/
	private worker_lifecycle(analysis_identity: ProjectAnalysisIdentityContract): LintRunWorkerLifecycleContract {
		const bridge = new PythonAstBridge();
		const registry = new PythonAstWorkerRegistry(process);
		const worker_lifecycle = new LintRunWorkerLifecycle({
			registry,
			worker_arguments: bridge.worker_arguments(),
			worker_options: bridge.worker_options(),
			analysis_identity,
			file_io: this._file_io,
			cache_enabled: bridge._cache_enabled,
		});
		worker_lifecycle.start_session();
		return worker_lifecycle;
	}

	/** Responsibilities: _project IO dependencies_. **/
	public constructor(source_io: ProjectSourceIOContract, file_io: IOContract) {
		this._source_io = source_io;
		this._file_io = file_io;
	}

	/** Responsibilities: _lint service dependency composition_. **/
	public assemble(): LintRunConfigurationAssemblyResult {
		const text_files = new TextFileDiscovery(this._source_io);
		const input_file_selector = new LintInputFileSelector(text_files, this._source_io);
		const analysis_identity = new ProjectAnalysisIdentity(this._file_io);
		const lint_run_analysis = new LintRunAnalysis(text_files, analysis_identity, this._file_io, this._source_io);
		return {
			dependencies: {
				input_file_selector,
				lint_run_analysis,
				analysis_identity,
				file_io: this._file_io,
				source_io: this._source_io,
			},
			worker_lifecycle: this.worker_lifecycle(analysis_identity),
		};
	}
}
