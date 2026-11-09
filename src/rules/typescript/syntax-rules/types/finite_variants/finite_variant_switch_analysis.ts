import { RULE_IDS } from "src/linting/constants";
import { FiniteVariantSwitchFallbackAnalysis } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_switch_fallback_analysis";
import { FiniteVariantSwitchSourceAnalysis } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_switch_source_analysis";
import type {
	FiniteVariantMembers,
	FiniteVariantSwitchSourceAnalysisContract,
} from "src/rules/typescript/syntax-rules/types/types";
import type { RuleContextContract } from "src/types";
import type ts from "typescript";

/** Responsibilities: _switch variant comparison_, _lossy conversion analysis_. **/
export class FiniteVariantSwitchAnalysis {
	private readonly _members_by_type: ReadonlyMap<string, FiniteVariantMembers>;
	private readonly _discriminants_by_type: ReadonlyMap<string, string>;
	private readonly _source_analysis: FiniteVariantSwitchSourceAnalysisContract;

	/** Responsibilities: _target variants for switch_. **/
	private target_variants(owner: ts.Node): FiniteVariantMembers {
		const target_name = this._source_analysis.target_type(owner);
		const members = this._members_by_type.get(target_name);
		if (members === undefined) {
			return new Set();
		}
		return members;
	}

	/** Responsibilities: _variant index dependency initialization_. **/
	public constructor(
		members_by_type: ReadonlyMap<string, FiniteVariantMembers>,
		discriminants_by_type: ReadonlyMap<string, string>,
	) {
		this._members_by_type = members_by_type;
		this._discriminants_by_type = discriminants_by_type;
		this._source_analysis = new FiniteVariantSwitchSourceAnalysis(members_by_type, discriminants_by_type);
	}

	/** Responsibilities: _lossy variant conversion classification_. **/
	public incomplete_mapping(node: ts.SwitchStatement, owner: ts.Node): boolean {
		const source_members = this._source_analysis.source_variants(node, owner);
		if (source_members.size === 0) {
			return false;
		}
		const target_members = this.target_variants(owner);
		if (target_members.size === 0) {
			return false;
		}
		const analysis = new FiniteVariantSwitchFallbackAnalysis(
			node,
			this._source_analysis,
			source_members,
			target_members,
			this._discriminants_by_type,
		);
		return analysis.incomplete();
	}

	/** Responsibilities: _single switch conversion analysis_. **/
	public append_switch(node: ts.SwitchStatement, context: RuleContextContract): void {
		const owner = this._source_analysis.owner(node);
		if (owner === node.getSourceFile()) {
			return;
		}
		context.state().analysis.stage_timer.measure("rule.finite-variant-mapping-is-incomplete.typescript", () => {
			if (this.incomplete_mapping(node, owner)) {
				context.for_node(node).append_rule(RULE_IDS.finite_variant_mapping_incomplete);
			}
		});
	}
}
