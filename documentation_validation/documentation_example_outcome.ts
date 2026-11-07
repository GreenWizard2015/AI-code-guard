import { DOCUMENTATION_EXCLUDED_SIZE_RULES, RESPONSIBILITY_RULE_PREFIX } from "documentation_validation/constants";
import type { DocumentationExample } from "documentation_validation/types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _example diagnostic filtering_, _example expectation evaluation_. **/
export class DocumentationExampleOutcome {
	private readonly _example: DocumentationExample;
	private readonly _all_violations: readonly ViolationContract[];
	private readonly _structural_errors: readonly string[];

	/** Responsibilities: _example diagnostic relevance_. **/
	private relevant_violation(violation: ViolationContract): boolean {
		if (DOCUMENTATION_EXCLUDED_SIZE_RULES.has(violation.rule_id())) {
			return false;
		}
		if (violation.rule_id() === this._example.rule_id) {
			return true;
		}
		if (violation.rule_id().startsWith(RESPONSIBILITY_RULE_PREFIX)) {
			return this._example.rule_id.startsWith(RESPONSIBILITY_RULE_PREFIX);
		}
		return true;
	}

	/** Responsibilities: _example outcome initialization_. **/
	public constructor(
		example: DocumentationExample,
		violations: readonly ViolationContract[],
		structural_errors: readonly string[],
	) {
		this._example = example;
		this._all_violations = violations;
		this._structural_errors = structural_errors;
	}

	/** Responsibilities: _example pass status_. **/
	public passes(): boolean {
		const relevant_violations = this._all_violations.filter((violation) => this.relevant_violation(violation));
		let passed = relevant_violations.some((violation) => violation.rule_id() === this._example.rule_id);
		if (this._example.kind === "Bad" && DOCUMENTATION_EXCLUDED_SIZE_RULES.has(this._example.rule_id)) {
			passed = true;
		}
		if (this._example.kind === "Good") {
			passed = relevant_violations.length === 0;
		}
		if (this._structural_errors.length > 0) {
			passed = false;
		}
		return passed;
	}

	/** Responsibilities: _example diagnostics_. **/
	public violations(): readonly ViolationContract[] {
		return this._all_violations.filter((violation) => this.relevant_violation(violation));
	}
}
