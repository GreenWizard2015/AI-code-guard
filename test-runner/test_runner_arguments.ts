import { REMOVED_SKIP_REVIEW_MESSAGE } from "src/constants";
import type { ReviewAgentSelection } from "src/task_review_types";
import { FORCE_REVIEW_ARGUMENT, HEADLESS_ARGUMENT, REVIEW_AGENT_OPTION } from "test-runner/constants";
import type { TestRunnerRequest } from "test-runner/types";

/** Responsibilities: _test runner command arguments_, _request option interpretation_. **/
export class TestRunnerArguments {
	private readonly _arguments_list: readonly string[];

	/** Responsibilities: _review agent option validation_. **/
	private review_agent_value(index: number): ReviewAgentSelection {
		const value = this._arguments_list[index + 1];
		switch (value) {
			case "codex":
			case "cx":
			case "cxa":
			case "claude":
				return value;
			default:
				throw new Error("Invalid --review-agent value");
		}
	}

	/** Responsibilities: _request default state_. **/
	private default_request(): TestRunnerRequest {
		return {
			args: [],
			help_requested: false,
			headless: false,
			skip_quality: false,
			force_review: false,
			review_agent: "none",
		};
	}

	/** Responsibilities: _request option application_. **/
	private apply_argument(request: TestRunnerRequest, argument: string): TestRunnerRequest {
		if (argument === "--skip-review") {
			throw new Error(REMOVED_SKIP_REVIEW_MESSAGE);
		}
		switch (argument) {
			case "--":
				return request;
			case "--help":
				return { ...request, help_requested: true };
			case HEADLESS_ARGUMENT:
				return { ...request, headless: true };
			case FORCE_REVIEW_ARGUMENT:
				return { ...request, force_review: true };
			case "--skip-quality":
				return { ...request, skip_quality: true };
			default:
				return { ...request, args: [...request.args, argument] };
		}
	}

	/** Responsibilities: _review agent selection_. **/
	private select_review_agent(request: TestRunnerRequest, index: number): TestRunnerRequest {
		if (request.review_agent !== "none") {
			return request;
		}
		const selection = this.review_agent_value(index);
		return { ...request, review_agent: selection };
	}

	/** Responsibilities: _command argument ownership_. **/
	public constructor(arguments_list: readonly string[]) {
		this._arguments_list = arguments_list;
	}

	/** Responsibilities: _review agent option presence_. **/
	public requires_review_agent(): boolean {
		return this._arguments_list.some((argument) => argument === REVIEW_AGENT_OPTION);
	}

	/** Responsibilities: _test runner request construction_. **/
	public request(): TestRunnerRequest {
		const review_agent_requested = this.requires_review_agent();
		let request = this.default_request();
		for (let index = 0; index < this._arguments_list.length; index += 1) {
			const next_argument = this._arguments_list[index];
			if (next_argument === undefined) {
				continue;
			}
			const argument = next_argument;
			if (review_agent_requested && argument === REVIEW_AGENT_OPTION) {
				request = this.select_review_agent(request, index);
				index += 1;
				continue;
			}
			request = this.apply_argument(request, argument);
		}
		return request;
	}
}
