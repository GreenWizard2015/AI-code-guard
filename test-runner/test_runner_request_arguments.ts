import {
	FORCE_REVIEW_ARGUMENT,
	HEADLESS_ARGUMENT,
	REVIEW_AGENT_OPTION,
	REVIEW_CLEANUP_ARGUMENT,
} from "test-runner/constants";
import type { ReviewAgentSelection } from "src/types";
import { REMOVED_SKIP_REVIEW_MESSAGE } from "src/constants";
import type { TestRunnerRequest } from "test-runner/types";

/** Responsibilities: _runner option parsing_, _review agent selection_. **/
export class TestRunnerRequestArguments {
	private readonly args: readonly string[];

	/** Responsibilities: _boolean runner argument application_. **/
	private apply_boolean_arg(request: TestRunnerRequest, arg: string): TestRunnerRequest {
		switch (arg) {
			case "--help":
				return { ...request, help_requested: true };
			case HEADLESS_ARGUMENT:
				return { ...request, headless: true };
			case FORCE_REVIEW_ARGUMENT:
				return { ...request, force_review: true };
			case "--skip-quality":
				return { ...request, skip_quality: true };
			case REVIEW_CLEANUP_ARGUMENT:
				return { ...request, review_cleanup: true };
			default:
				return request;
		}
	}

	/** Responsibilities: _review agent option validation_. **/
	private review_agent_value(args: readonly string[], index: number): ReviewAgentSelection {
		const value = args[index + 1];
		if (value !== "codex" && value !== "claude") {
			throw new Error("Invalid --review-agent value");
		}
		return value;
	}

	/** Responsibilities: _runner argument application_. **/
	private apply_arg(request: TestRunnerRequest, arg: string): TestRunnerRequest {
		if (arg === "--") {
			return request;
		}
		if (arg === "--skip-review") {
			throw new Error(REMOVED_SKIP_REVIEW_MESSAGE);
		}
		const boolean_request = this.apply_boolean_arg(request, arg);
		if (boolean_request !== request) {
			return boolean_request;
		}
		return { ...request, args: [...request.args, arg] };
	}

	/** Responsibilities: _review agent selection_. **/
	private selected_agent(request: TestRunnerRequest, index: number): TestRunnerRequest {
		if (request.review_agent !== "none") {
			return request;
		}
		return { ...request, review_agent: this.review_agent_value(this.args, index) };
	}

	/** Responsibilities: _runner request defaults_. **/
	private default_request(): TestRunnerRequest {
		return {
			args: [],
			help_requested: false,
			headless: false,
			skip_quality: false,
			force_review: false,
			review_cleanup: false,
			review_agent: "none",
		};
	}

	/** Responsibilities: _request arguments initialization_. **/
	public constructor(args: readonly string[]) {
		this.args = args;
	}

	/** Responsibilities: _review agent option detection_. **/
	public requires_review_agent(): boolean {
		for (const arg of this.args) {
			if (arg === REVIEW_AGENT_OPTION) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _runner request value_. **/
	public request(): TestRunnerRequest {
		let request = this.default_request();
		const review_agent_requested = this.requires_review_agent();
		for (let index = 0; index < this.args.length; index += 1) {
			const arg = this.args[index];
			if (review_agent_requested) {
				if (arg !== REVIEW_AGENT_OPTION) {
					request = this.apply_arg(request, arg);
					continue;
				}
				request = this.selected_agent(request, index);
				index += 1;
				continue;
			}
			request = this.apply_arg(request, arg);
		}
		return request;
	}
}
