import { MAX_CLASS_INTERFACES } from "src/constants";
import type { LintFileNameContract } from "src/core/support/protocols";
import { PROCEDURAL_CLASS_JOB_TITLE_SUFFIXES } from "src/metrics/constants";
import type { ClassStateEvidence, ClassStructureReporterOptions } from "src/metrics/types";
import type {
	AstClassNodeClassification,
	AstClassNodeFieldAnalysis,
	AstClassNodeIdentity,
	AstClassNodeStructure,
} from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _class design diagnosis_, _class state assessment_. **/
export class ClassDesignReporter {
	private readonly _violations: ViolationContract[];
	private readonly _file_name: LintFileNameContract;
	private readonly _class_identity: AstClassNodeIdentity;
	private readonly _class_structure: AstClassNodeStructure;
	private readonly _classification: AstClassNodeClassification;
	private readonly _field_analysis: AstClassNodeFieldAnalysis;
	private readonly _mutated_readonly_fields: ReadonlySet<string>;
	private readonly _project_class_names: ReadonlySet<string>;
	private readonly _project_contract_names: ReadonlySet<string>;
	private readonly _project_alias_names: ReadonlySet<string>;
	private readonly _class_state: ClassStateEvidence;

	/** Responsibilities: _instance field state classification_. **/
	private stateful_fields(): boolean {
		for (const field of this._field_analysis.fields) {
			if (field.class_variable || field.class_scope) {
				continue;
			}
			if (!field.readonly || this._mutated_readonly_fields.has(field.name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _class state classification_. **/
	private stateful(): boolean {
		if (this.stateful_fields()) {
			return true;
		}
		if (this._class_state.inherited_instance_state) {
			return true;
		}
		for (const name of this._class_structure.base_class_names) {
			if (this._class_state.inherited_state_names.has(name)) {
				return true;
			}
		}
		return this._class_state.constructor_injected_state;
	}

	/** Responsibilities: _procedural class-name diagnosis_. **/
	private append_procedural_name(): void {
		let singular_name = this._class_identity.name;
		if (singular_name.endsWith("ies")) {
			singular_name = `${singular_name.slice(0, -3)}y`;
		} else if (singular_name.endsWith("s")) {
			singular_name = singular_name.slice(0, -1);
		}
		const matches_job_title = PROCEDURAL_CLASS_JOB_TITLE_SUFFIXES.some(
			(suffix) => this._class_identity.name.endsWith(suffix) || singular_name.endsWith(suffix),
		);
		if (!matches_job_title) {
			return;
		}
		const rule = new DiagnosticRule("procedural-class-name");
		this._violations.push(
			rule.violation(this._file_name.value(), this._class_identity.start + 1, { name: this._class_identity.name }),
		);
	}

	/** Responsibilities: _external alias inheritance_. **/
	private external_alias_inheritance(): void {
		for (const base_name of this._class_structure.base_class_names) {
			if (!this._project_alias_names.has(base_name)) {
				continue;
			}
			if (this._project_contract_names.has(base_name)) {
				continue;
			}
			const rule = new DiagnosticRule("local-inheritance");
			this._violations.push(rule.violation(this._file_name.value(), this._class_identity.start + 1, { base_name }));
			return;
		}
	}

	/** Responsibilities: _unresolved protocol base detection_. **/
	private unresolved_protocol_base(base_name: string): boolean {
		if (!this._classification.protocol) {
			return false;
		}
		if (this._project_class_names.has(base_name)) {
			return false;
		}
		return !this._project_alias_names.has(base_name);
	}

	/** Responsibilities: _concrete base inheritance_. **/
	private invalid_base_inheritance(): boolean {
		for (const base_name of this._class_structure.base_class_names) {
			if (this._project_contract_names.has(base_name) || base_name.length === 0) {
				continue;
			}
			if (this.unresolved_protocol_base(base_name)) {
				continue;
			}
			const rule = new DiagnosticRule("local-inheritance");
			this._violations.push(rule.violation(this._file_name.value(), this._class_identity.start + 1, { base_name }));
			return true;
		}
		return false;
	}

	/** Responsibilities: _implemented alias detection_. **/
	private invalid_implementation(): void {
		for (const implemented_name of this._class_structure.interfaces ?? []) {
			if (!this._project_alias_names.has(implemented_name)) {
				continue;
			}
			if (this._project_contract_names.has(implemented_name)) {
				continue;
			}
			const rule = new DiagnosticRule("local-inheritance");
			this._violations.push(
				rule.violation(this._file_name.value(), this._class_identity.start + 1, { base_name: implemented_name }),
			);
			return;
		}
	}

	/** Responsibilities: _local inheritance diagnosis_. **/
	private append_local_inheritance(): void {
		if (this._classification.extends_external_class && !this._classification.protocol) {
			this.external_alias_inheritance();
			return;
		}
		if (this.invalid_base_inheritance()) {
			return;
		}
		this.invalid_implementation();
	}

	/** Responsibilities: _class initialization_. **/
	public constructor(options: ClassStructureReporterOptions) {
		this._violations = options.violations;
		this._file_name = options.file_name;
		this._class_identity = options.node.identity;
		this._class_structure = options.node.structure;
		this._classification = options.node.classification;
		this._field_analysis = options.node.field_analysis;
		this._mutated_readonly_fields = options.mutated_readonly_fields;
		this._project_class_names = options.project_class_names;
		this._project_contract_names = options.project_contract_names;
		this._project_alias_names = options.project_alias_names;
		this._class_state = options.class_state;
	}

	/** Responsibilities: _class reporting eligibility_. **/
	public reportable_class(): boolean {
		if (this._file_name.test()) {
			return false;
		}
		if (this._classification.type_contract || this._classification.protocol) {
			return false;
		}
		return !this._classification.extends_external_class;
	}

	/** Responsibilities: _interface count diagnosis_. **/
	public report_interface_limit(): void {
		const interfaces = this._class_structure.interfaces ?? [];
		if (interfaces.length <= MAX_CLASS_INTERFACES) {
			return;
		}
		const rule = new DiagnosticRule("class-interface-count");
		this._violations.push(
			rule.violation(this._file_name.value(), this._class_identity.start + 1, { count: String(interfaces.length) }),
		);
	}

	/** Responsibilities: _class design diagnostics_. **/
	public report_class_design(): void {
		if (this._file_name.test()) {
			return;
		}
		this.append_local_inheritance();
		if (!this.reportable_class()) {
			return;
		}
		if (!this.stateful() && this._class_structure.interfaces.length === 0) {
			const rule = new DiagnosticRule("stateless-class");
			this._violations.push(rule.violation(this._file_name.value(), this._class_identity.start + 1));
		}
		this.append_procedural_name();
	}
}
