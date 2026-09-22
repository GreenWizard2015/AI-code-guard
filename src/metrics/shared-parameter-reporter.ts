import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { RuleParameters } from 'src/types';
import type {
	CallableLocation,
	SharedCallableKind,
	SharedParameterCandidate,
} from 'src/metrics/types';

/** Responsibilities: _shared-parameter candidates diagnostic formatting_. **/
export class SharedParameterReporter {
	private readonly candidates: readonly SharedParameterCandidate[];

	/** Responsibilities: _choose grammatical noun callable_. **/
	private noun(kind: SharedCallableKind): string {
		if (kind === 'method') {
			return 'methods';
		}
		return 'functions';
	}

	/** Responsibilities: _callable location diagnostic formatting_. **/
	private location_label(kind: SharedCallableKind, location: CallableLocation): string {
		if (kind === 'method') {
			return location.method;
		}
		return `${location.file}:${location.line} ${location.method}`;
	}

	/** Responsibilities: _selection diagnostic rule shared-parameter_. **/
	private message_rule(candidate: SharedParameterCandidate): DiagnosticRule {
		let rule_id = 'shared-parameter-type';
		if (candidate.nodes.length > 1) {
			rule_id = 'shared-parameter-combination';
		}
		return new DiagnosticRule(rule_id);
	}

	/** Responsibilities: _construction diagnostic parameters shared-parameter_. **/
	private message_parameters(candidate: SharedParameterCandidate): RuleParameters {
		const parameters = candidate.nodes.map(node => node.identity).join(', ');
		const candidates = candidate.locations
			.map(location => this.location_label(candidate.kind, location))
			.join('; ');
		return {
			noun: this.noun(candidate.kind),
			parameters,
			support: String(candidate.support),
			candidates,
		};
	}

	/** Responsibilities: _creation violation shared-parameter candidate_. **/
	private violation(candidate: SharedParameterCandidate): Violation {
		if (candidate.locations.length === 0) {
			throw new Error('Shared parameter candidate has no callable locations.');
		}
		const location = candidate.locations[0];
		const rule = this.message_rule(candidate);
		return rule.violation(location.file, location.line, this.message_parameters(candidate));
	}

	/** Responsibilities: _initialization candidates diagnostic formatting_. **/
	public constructor(candidates: readonly SharedParameterCandidate[]) {
		this.candidates = candidates;
	}

	/** Responsibilities: _human-readable message rendering_. **/
	public message(candidate: SharedParameterCandidate): string {
		const rule = this.message_rule(candidate);
		const parameters = this.message_parameters(candidate);
		const violation = rule.violation('', 0, parameters);
		return violation.message;
	}

	/** Responsibilities: _candidates diagnostic violations conversion_. **/
	public violations(): Violation[] {
		return this.candidates.map(candidate => this.violation(candidate));
	}
}
