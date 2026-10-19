import type { ChildProcess, SpawnOptions } from "node:child_process";
import { ReviewAgentProcess } from "src/core/support/task/review_agent_process";

/** Responsibilities: _child process simulation_, _spawn option observation_. **/
export class FakeReviewAgentProcess extends ReviewAgentProcess {
	private readonly child: ChildProcess;
	private readonly spawn_options_list: SpawnOptions[];

	/** Responsibilities: _fake production child spawning_. **/
	protected override spawn_child(
		_command: string,
		_arguments_list: readonly string[],
		options: SpawnOptions,
	): ChildProcess {
		this.spawn_options_list.push(options);
		return this.child;
	}

	/** Responsibilities: _fake process initialization_. **/
	public constructor(child: ChildProcess) {
		super();
		this.child = child;
		this.spawn_options_list = [];
	}

	/** Responsibilities: _production spawn option observation_. **/
	public spawn_options(): readonly SpawnOptions[] {
		return this.spawn_options_list;
	}
}
