import { spawn, spawnSync } from "node:child_process";
import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";
import { NODE_MODULES_DIRECTORY, REPORTING_PROJECT_ROOT } from "src/constants";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { NodeReviewAgentChildProcess } from "src/core/support/task/review-agent/process/node_review_agent_child_process";
import { ReviewAgentProcess } from "src/core/support/task/review-agent/process/review_agent_process";
import type {
	ReviewAgentCatalogContract,
	ReviewAgentHookConfiguration,
	ReviewAgentProcessSpawnerContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentChildProcessContract } from "src/core/support/task/review-agent/protocols";
import { ClaudeReviewAgent } from "src/core/support/task/review-agent/providers/claude_review_agent";
import { CodexReviewAgent } from "src/core/support/task/review-agent/providers/codex_review_agent";
import { ReviewAgentCatalog } from "src/core/support/task/review-agent/providers/review_agent_catalog";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review provider runtime_, _hook process ownership_. **/
export class TaskReviewAgentRuntime implements ReviewAgentProcessSpawnerContract {
	private readonly _root: string;
	private readonly _file_io: IOContract;
	private readonly _process: ReviewAgentProcess;

	/** Responsibilities: _review runtime configuration_. **/
	public constructor(root: string, file_io: IOContract) {
		this._root = root;
		this._file_io = file_io;
		const process_signal = new NodeProcessSignal(process, this._file_io, process.platform);
		this._process = new ReviewAgentProcess(this._file_io, this, process.platform, process_signal);
	}

	/** Responsibilities: _review child process creation_. **/
	public spawn_child(
		command: string,
		arguments_list: readonly string[],
		options: SpawnOptions,
	): ReviewAgentChildProcessContract {
		return new NodeReviewAgentChildProcess(spawn(command, [...arguments_list], options));
	}

	/** Responsibilities: _synchronous provider process execution_. **/
	public spawn_sync(
		command: string,
		arguments_list: readonly string[],
		options: SpawnSyncOptionsWithStringEncoding,
	): SpawnSyncReturns<string> {
		return spawnSync(command, [...arguments_list], options);
	}

	/** Responsibilities: _review provider selection_. **/
	public catalog(): ReviewAgentCatalogContract {
		return new ReviewAgentCatalog(
			[new CodexReviewAgent(this._process), new ClaudeReviewAgent(this._process)],
			this._file_io,
		);
	}

	/** Responsibilities: _review hook execution configuration_. **/
	public hook_configuration(): ReviewAgentHookConfiguration {
		const command = join(REPORTING_PROJECT_ROOT, NODE_MODULES_DIRECTORY, ".bin", "tsx");
		const file = join(REPORTING_PROJECT_ROOT, "src", "core", "support", "task", "agent-hooks.ts");
		return { command, file, hooks: new ReviewAgentHooks(this._root, command, file, this._process) };
	}
}
