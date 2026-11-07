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

/** Responsibilities: _public API metrics_, _implementation specialization checks_. **/
export class MethodSpecializationReporter {
	private readonly _violations: ViolationContract[];

	private readonly _file: string;

	private readonly _class_identity: AstClassNodeIdentity;
	private readonly _class_structure: AstClassNodeStructure;
	private readonly _classification: AstClassNodeClassification;
	private readonly _field_analysis: AstClassNodeFieldAnalysis;

	private readonly _methods: readonly AstCallableNode[];
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
		const count = methods.filter((method) => method.identity.visibility !== "public").length;
		if (count > 15) {
			const rule = new DiagnosticRule("class-method-max-count");
			this._violations.push(
				rule.violation(this._file, this._class_identity.start + 1, { count: String(count), visibility: "non-public" }),
			);
		}
	}

	/** Responsibilities: _aggregation visibility method-count diagnostics_. **/
	private append_public_rules(methods: readonly AstCallableNode[]): void {
		const count = methods.filter((method) => method.identity.visibility === "public").length;
		const rule_id = this.public_method_rule(count);
		if (rule_id.length > 0) {
			const rule = new DiagnosticRule(rule_id);
			this._violations.push(
				rule.violation(this._file, this._class_identity.start + 1, { count: String(count), visibility: "public" }),
			);
		}
	}

	/** Responsibilities: _creation configuration public-method diagnostic_. **/
	private public_method_rule(count: number): string {
		if (count > 15) {
			return RULE_IDS.class_method_max_count;
		}
		if (count > 6 && this._declares_interface) {
			return "";
		}
		if (count < 2 && !this._inherits_contract) {
			return RULE_IDS.class_method_min_count;
		}
		if (count > 6) {
			return RULE_IDS.class_method_count_info;
		}
		return "";
	}

	/** Responsibilities: _initialization violation sink file_. **/
	public constructor(violations: ViolationContract[], file: string, node: AstClassNode) {
		this._violations = violations;
		this._file = file;
		this._class_identity = node.identity;
		this._class_structure = node.structure;
		this._classification = node.classification;
		this._field_analysis = node.field_analysis;
		this._methods = this._class_structure.methods.filter((method) => this.included_method(method));
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
		this.append_public_rules(this._methods);
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
