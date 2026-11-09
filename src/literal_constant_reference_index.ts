import { IMPLEMENTATION_RELATION } from "src/constants";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { AstLiteralReference } from "src/model/ast/normalized_ast_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _literal reference indexing_, _constant reuse findings_. **/
export class LiteralConstantReferenceIndex {
	private readonly _sources: readonly LintSourceRecordData[];
	private readonly _rule: RuleContract;
	private readonly _repeated_rule: RuleContract;
	private readonly _references: SourceReferenceIndex<string>;
	private readonly _constant_names: Map<string, string>;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _repeated literal diagnostic_. **/
	private append_repeated(
		violations: ViolationContract[],
		source: LintSourceRecordData,
		line: number,
		usage_count: number,
	): void {
		this._stage_timer.measure("rule.repeated-literal", () => {
			if (usage_count < 2) {
				return;
			}
			violations.push(this._repeated_rule.violation(source.file_name.value(), line, {}));
		});
	}

	/** Responsibilities: _literal violation collection_. **/
	private append_reference(
		violations: ViolationContract[],
		source: LintSourceRecordData,
		reference: AstLiteralReference,
	): void {
		this._stage_timer.measure("rule.literal-constant-reuse.analysis", () => {
			const key = `${source.language}\u0000${reference.value}`;
			const name = this._constant_names.get(key);
			const implementations = this._references.references_for(key, IMPLEMENTATION_RELATION);
			if (name === undefined) {
				const usages = this._references.references_for(key, "usage");
				this.append_repeated(violations, source, reference.line + 1, usages.length);
				return;
			}
			if (implementations.length > 0) {
				violations.push(this._rule.violation(source.file_name.value(), reference.line + 1, { constant: name }));
			}
		});
	}

	/** Responsibilities: _literal reference index initialization_. **/
	public constructor(
		sources: readonly LintSourceRecordData[],
		rule: RuleContract,
		repeated_rule: RuleContract,
		stage_timer: LintStageTimerContract,
	) {
		this._sources = sources;
		this._rule = rule;
		this._repeated_rule = repeated_rule;
		this._references = new SourceReferenceIndex<string>();
		this._constant_names = new Map();
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _constant implementation registration_. **/
	public register_constants(): void {
		for (const source of this._sources) {
			for (const constant of source.normalized_ast.references.literal_constants) {
				const key = `${source.language}\u0000${constant.value}`;
				const current_name = this._constant_names.get(key);
				if (current_name === undefined || constant.name < current_name) {
					this._constant_names.set(key, constant.name);
				}
				this._references.add_implementation(key, { file: source.file_name.value(), line: constant.line + 1 });
			}
		}
	}

	/** Responsibilities: _literal usage registration_. **/
	public register_references(): void {
		for (const source of this._sources) {
			for (const reference of source.normalized_ast.references.literal_references) {
				const key = `${source.language}\u0000${reference.value}`;
				this._references.add_usage(key, { file: source.file_name.value(), line: reference.line + 1 });
			}
		}
	}

	/** Responsibilities: _literal violation collection_. **/
	public collect_violations(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const source of this._sources) {
			for (const reference of source.normalized_ast.references.literal_references) {
				this.append_reference(violations, source, reference);
			}
		}
		return violations;
	}
}
