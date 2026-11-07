import { DOCUMENTATION_FUNCTIONS_MODULE_NAME } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import type { CallableLocation, SharedCallableKind, SharedParameterCandidate } from "src/metrics/types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type { RuleParameters } from "src/types";

/** Responsibilities: _diagnostic message formatting_, _violation construction_. **/
export class SharedParameterReporter {
	private readonly _candidates: readonly SharedParameterCandidate[];

	/** Responsibilities: _choose grammatical noun callable_. **/
	private noun(kind: SharedCallableKind): string {
		if (kind === "method") {
			return "methods";
		}
		return DOCUMENTATION_FUNCTIONS_MODULE_NAME;
	}

	/** Responsibilities: _callable location diagnostic formatting_. **/
	private location_label(kind: SharedCallableKind, location: CallableLocation): string {
		if (kind === "method") {
			return location.method;
		}
		return `${location.file}:${location.line} ${location.method}`;
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
		const rule = new DiagnosticRule(RULE_IDS.shared_parameter);
		for (const location of candidate.locations) {
			return rule.violation(location.file, location.line, this.message_parameters(candidate));
		}
		throw new Error("Shared parameter candidate has no callable locations.");
	}

	/** Responsibilities: _initialization candidates diagnostic formatting_. **/
	public constructor(candidates: readonly SharedParameterCandidate[]) {
		this._candidates = candidates;
	}

	/** Responsibilities: _empty shared-parameter report detection_. **/
	public empty(): boolean {
		return this._candidates.length === 0;
	}

	/** Responsibilities: _candidates diagnostic violations conversion_. **/
	public violations(): ViolationContract[] {
		if (this.empty()) {
			return [];
		}
		return this._candidates.map((candidate) => this.violation(candidate));
	}
}
