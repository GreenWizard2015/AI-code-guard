import { RULE_IDS } from "src/linting/constants";
import { CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME } from "src/metrics/constants";
import type {
	AstCallableNode,
	AstClassNode,
	AstClassNodeClassification,
	AstClassNodeFieldAnalysis,
	AstClassNodeIdentity,
	AstClassNodeStructure,
} from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _public API metrics_, _implementation specialization checks_. **/
export class MethodSpecializationReporter {
	private readonly _violations: ViolationContract[];
	private readonly _stage_timer: LintStageTimerContract;

	private readonly _file: string;

	private readonly _class_identity: AstClassNodeIdentity;
	private readonly _class_structure: AstClassNodeStructure;
	private readonly _classification: AstClassNodeClassification;
	private readonly _field_analysis: AstClassNodeFieldAnalysis;

	private readonly _methods: readonly AstCallableNode[];
	private readonly _public_method_count: number;
	private readonly _inherits_contract: boolean;
	private readonly _declares_interface: boolean;

	/** Responsibilities: _specialization method selection_. **/
	private included_method(method: AstCallableNode): boolean {
		if (method.identity.name === CONSTRUCTOR_NAME) {
			return false;
		}
		if (method.identity.name === PYTHON_CONSTRUCTOR_NAME) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _aggregation callback-field diagnostics analysis_. **/
	private append_callback_rule(): void {
		if (this._field_analysis.callback_fields === 0) {
			return;
		}
		const inline_callback_fields = this._field_analysis.inline_callback_fields;
		if (inline_callback_fields === 0) {
			return;
		}
		const rule = new DiagnosticRule("typescript-class-callback-fields");
		this._violations.push(
			rule.violation(this._file, this._class_identity.start + 1, {
				count: String(inline_callback_fields),
			}),
		);
	}

	/** Responsibilities: _aggregation implementation metrics concrete_. **/
	private append_implementation_rules(methods: readonly AstCallableNode[]): void {
		this._stage_timer.measure(`rule.${RULE_IDS.class_method_max_count}`, () => {
			const count = methods.filter((method) => method.identity.visibility !== "public").length;
			if (count > 15) {
				const rule = new DiagnosticRule(RULE_IDS.class_method_max_count);
				this._violations.push(
					rule.violation(this._file, this._class_identity.start + 1, {
						count: String(count),
						visibility: "non-public",
					}),
				);
			}
		});
	}

	/** Responsibilities: _aggregation visibility method-count diagnostics_. **/
	private append_public_rules(): void {
		if (this.append_public_maximum()) {
			return;
		}
		if (this._public_method_count > 6 && this._declares_interface) {
			return;
		}
		if (this.append_public_minimum()) {
			return;
		}
		this.append_count_info();
	}

	/** Responsibilities: _maximum public method diagnostics_. **/
	private append_public_maximum(): boolean {
		return this._stage_timer.measure(`rule.${RULE_IDS.class_method_max_count}`, () => {
			if (this._public_method_count <= 15) {
				return false;
			}
			this.append_public_violation(RULE_IDS.class_method_max_count);
			return true;
		});
	}

	/** Responsibilities: _minimum public method diagnostics_. **/
	private append_public_minimum(): boolean {
		return this._stage_timer.measure(`rule.${RULE_IDS.class_method_min_count}`, () => {
			if (this._public_method_count >= 2 || this._inherits_contract) {
				return false;
			}
			this.append_public_violation(RULE_IDS.class_method_min_count);
			return true;
		});
	}

	/** Responsibilities: _public method count information_. **/
	private append_count_info(): void {
		this._stage_timer.measure(`rule.${RULE_IDS.class_method_count_info}`, () => {
			if (this._public_method_count > 6) {
				this.append_public_violation(RULE_IDS.class_method_count_info);
			}
		});
	}

	/** Responsibilities: _public method count diagnostics_. **/
	private append_public_violation(rule_id: string): void {
		const rule = new DiagnosticRule(rule_id);
		this._violations.push(
			rule.violation(this._file, this._class_identity.start + 1, {
				count: String(this._public_method_count),
				visibility: "public",
			}),
		);
	}

	/** Responsibilities: _initialization violation sink file_. **/
	public constructor(
		violations: ViolationContract[],
		file: string,
		node: AstClassNode,
		stage_timer: LintStageTimerContract,
	) {
		this._violations = violations;
		this._stage_timer = stage_timer;
		this._file = file;
		this._class_identity = node.identity;
		this._class_structure = node.structure;
		this._classification = node.classification;
		this._field_analysis = node.field_analysis;
		this._methods = this._class_structure.methods.filter((method) => this.included_method(method));
		this._public_method_count = this._methods.filter((method) => method.identity.visibility === "public").length;
		this._declares_interface = this._class_structure.interfaces.length > 0;
		this._inherits_contract = this._declares_interface || this._class_structure.base_class_names.length > 0;
	}

	/** Responsibilities: _reporting API-facing class method_. **/
	public report_api(): void {
		if (this._classification.is_data_class) {
			return;
		}
		if (this._methods.length === 0) {
			return;
		}
		this.append_public_rules();
		this.append_callback_rule();
	}

	/** Responsibilities: _reporting implementation-facing class specialization_. **/
	public report_implementation(): void {
		if (this._classification.is_data_class) {
			return;
		}
		if (this._classification.type_contract || this._classification.protocol) {
			return;
		}
		this.append_implementation_rules(this._methods);
	}
}
