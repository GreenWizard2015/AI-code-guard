import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract, ViolationContract } from "src/protocols";
import type { RuleParameters } from "src/types";
import type { CallableLocation, SharedCallableKind, SharedParameterCandidate } from "src/metrics/types";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _diagnostic message formatting_, _violation construction_. **/
export class SharedParameterReporter {
	private readonly candidates: readonly SharedParameterCandidate[];

	/** Responsibilities: _choose grammatical noun callable_. **/
	private noun(kind: SharedCallableKind): string {
		if (kind === "method") {
			return "methods";
		}
		return "functions";
	}

	/** Responsibilities: _callable location diagnostic formatting_. **/
	private location_label(kind: SharedCallableKind, location: CallableLocation): string {
		if (kind === "method") {
			return location.method;
		}
		return `${location.file}:${location.line} ${location.method}`;
	}

	/** Responsibilities: _selection diagnostic rule shared-parameter_. **/
	private message_rule(candidate: SharedParameterCandidate): RuleContract {
		let rule_id: string = RULE_IDS.shared_parameter_type;
		if (candidate.nodes.length > 1) {
			rule_id = RULE_IDS.shared_parameter_combination;
		}
		return new DiagnosticRule(rule_id);
	}

	/** Responsibilities: _construction diagnostic parameters shared-parameter_. **/
	private message_parameters(candidate: SharedParameterCandidate): RuleParameters {
		const parameters = candidate.nodes.map((node) => node.identity).join(", ");
		const candidates = candidate.locations.map((location) => this.location_label(candidate.kind, location)).join("; ");
		return {
			noun: this.noun(candidate.kind),
			parameters,
			support: String(candidate.support),
			candidates,
		};
	}

	/** Responsibilities: _creation violation shared-parameter candidate_. **/
	private violation(candidate: SharedParameterCandidate): ViolationContract {
		if (candidate.locations.length === 0) {
			throw new Error("Shared parameter candidate has no callable locations.");
		}
		const location = candidate.locations[0];
		const rule = this.message_rule(candidate);
		return rule.violation(location.file, location.line, this.message_parameters(candidate));
	}

	/** Responsibilities: _initialization candidates diagnostic formatting_. **/
	public constructor(candidates: readonly SharedParameterCandidate[]) {
		this.candidates = candidates;
	}

	/** Responsibilities: _empty shared-parameter report detection_. **/
	public empty(): boolean {
		return this.candidates.length === 0;
	}

	/** Responsibilities: _candidates diagnostic violations conversion_. **/
	public violations(): ViolationContract[] {
		if (this.empty()) {
			return [];
		}
		return this.candidates.map((candidate) => this.violation(candidate));
	}
}
