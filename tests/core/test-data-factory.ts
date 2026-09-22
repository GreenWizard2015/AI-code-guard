import type { AnalyzedCallable, AnalyzedParameter, SharedCallableKind, SharedParameterCandidate, SharedParameterKind } from 'src/metrics/types';

/** Responsibilities: _construction shared-parameter test data_. **/
export class TestDataFactory {
	private readonly reference_kind = 'reference';
	private readonly primitive_kind = 'basic';

	/** Responsibilities: _creation stable parameter key_. **/
	private parameter_key(kind: string, identity: string): string {
		return JSON.stringify([kind, identity]);
	}

	/** Responsibilities: _construction analysis parameter fixture_. **/
	private parameter(
		kind: SharedParameterKind,
		identity: string,
		project_type: boolean,
		uses: number
	): AnalyzedParameter {
		return {
			key: this.parameter_key(kind, identity),
			identity,
			kind,
			project_type,
			uses,
		};
	}

	/** Responsibilities: _construction reference parameter fixture_. **/
	public reference_parameter(identity: string, uses = 1): AnalyzedParameter {
		return this.parameter(this.reference_kind, identity, true, uses);
	}

	/** Responsibilities: _construction primitive parameter fixture_. **/
	public primitive_parameter(name: string, type: string, uses = 1): AnalyzedParameter {
		const normalized_type = type.trim();
		const identity = `${name}:${normalized_type}`;
		return this.parameter(this.primitive_kind, identity, false, uses);
	}

	/** Responsibilities: _construction analysis callable fixture_. **/
	public analyzed_callable(
		method: string,
		line: number,
		parameters: readonly AnalyzedParameter[],
		file = 'fixture.ts',
		kind: SharedCallableKind = 'function'
	): AnalyzedCallable {
		return { kind, language: 'unknown', location: { file, line, method }, parameters };
	}

	/** Responsibilities: _shared-parameter candidate fixture formatting_. **/
	public candidate_name(candidate: SharedParameterCandidate): string {
		return candidate.nodes.map(node => node.identity).join(', ');
	}

	/** Responsibilities: _construction named shared-parameter candidate_. **/
	public candidate_named(
		candidates: readonly SharedParameterCandidate[],
		name: string
	): SharedParameterCandidate[] {
		for (const candidate of candidates) {
			if (this.candidate_name(candidate) === name) {
				return [candidate];
			}
		}
		return [];
	}
}
