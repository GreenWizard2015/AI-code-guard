import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ClassDefinition } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { CLASS_REFERENCE_INFO, CLASS_REFERENCE_WARNING } from "src/rules/constants";
import type { LintStageTimerContract, SourceReferenceIndexContract } from "src/shared_services_protocols";

/** Responsibilities: _reference metrics_, _threshold diagnostics_. **/
export class ClassReferenceMetricEvaluation {
	private readonly _file: string;
	private readonly _line: number;
	private readonly _name: string;
	private readonly _references_by_class: SourceReferenceIndexContract<string>;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _materializing class-reference diagnostic_. **/
	private violation(rule_id: string, count: number): ViolationContract {
		return this._stage_timer.measure(`rule.${rule_id}.materialization`, () => {
			const rule = new DiagnosticRule(rule_id);
			return rule.violation(this._file, this._line, { name: this._name, count: String(count) });
		});
	}

	/** Responsibilities: _class-reference evaluation dependencies_. **/
	public constructor(
		definition: ClassDefinition,
		references_by_class: SourceReferenceIndexContract<string>,
		stage_timer: LintStageTimerContract,
	) {
		this._file = definition.file;
		this._line = definition.node.identity.start + 1;
		this._name = definition.node.identity.name;
		this._references_by_class = references_by_class;
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _external reference count_. **/
	public reference_count(): number {
		return this._stage_timer.measure("class-reference-metric.usage-count", () => {
			const references = this._references_by_class.references_for(this._name, "usage");
			const files = new Set(references.map((reference) => reference.file));
			files.delete(this._file);
			return files.size;
		});
	}

	/** Responsibilities: _rule evaluation_. **/
	public violations(): ViolationContract[] {
		const count = this.reference_count();
		if (this._stage_timer.measure(`rule.${RULE_IDS.class_reference_warning}`, () => count >= CLASS_REFERENCE_WARNING)) {
			return [this.violation(RULE_IDS.class_reference_warning, count)];
		}
		if (this._stage_timer.measure(`rule.${RULE_IDS.class_reference_info}`, () => count >= CLASS_REFERENCE_INFO)) {
			return [this.violation(RULE_IDS.class_reference_info, count)];
		}
		return [];
	}
}
