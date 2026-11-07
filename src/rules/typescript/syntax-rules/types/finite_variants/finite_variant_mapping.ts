import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { FiniteVariantSourceNodes } from "src/rules/typescript/syntax-rules/types";
import { FiniteVariantDeclarationIndex } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_declaration_index";
import { FiniteVariantDiscriminatedUnionIndex } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_discriminated_union_index";
import { FiniteVariantEnumIndex } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_enum_index";
import { FiniteVariantSwitchAnalysis } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_switch_analysis";
import type { FiniteVariantSwitchAnalysisContract } from "src/rules/typescript/syntax-rules/types/types";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _finite variant declaration index_, _switch case mapping_. **/
export class FiniteVariantMapping implements ASTSourceRuleContract {
	private readonly _nodes_by_context: WeakMap<RuleContextContract, FiniteVariantSourceNodes>;

	/** Responsibilities: _variant declaration inputs_, _switch analysis context_. **/
	private analysis(context: RuleContextContract, nodes: readonly ts.Node[]): FiniteVariantSwitchAnalysisContract {
		const declarations = new FiniteVariantDeclarationIndex(
			new FiniteVariantDiscriminatedUnionIndex(),
			new FiniteVariantEnumIndex(),
		);
		declarations.append_local(nodes);
		const source_file = context.state().source.source_file;
		declarations.append_imports(source_file, context);
		return new FiniteVariantSwitchAnalysis(declarations._members_by_type, declarations._discriminants_by_type);
	}

	/** Responsibilities: _finite source node accumulation_. **/
	private append_source_node(request: TypeScriptNodeVerificationRequest): void {
		const { context, node } = request;
		const is_switch = ts.isSwitchStatement(node);
		const is_declaration =
			ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isInterfaceDeclaration(node);
		if (!is_switch && !is_declaration) {
			return;
		}
		let collected = this._nodes_by_context.get(context);
		if (collected === undefined) {
			collected = { declarations: [], switches: [] };
			this._nodes_by_context.set(context, collected);
		}
		if (is_switch) {
			collected.switches.push(node);
		} else {
			collected.declarations.push(node);
		}
	}

	/** Responsibilities: _finite-variant verifier initialization_. **/
	public constructor() {
		this._nodes_by_context = new WeakMap();
	}

	/** Responsibilities: _finite-variant rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _switch mapping node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (request.context.state().source.test_file) {
			return;
		}
		this.append_source_node(request);
	}

	/** Responsibilities: _finite variant source verification_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const collected = this._nodes_by_context.get(context);
		this._nodes_by_context.delete(context);
		if (collected === undefined || collected.switches.length === 0) {
			return;
		}
		const analysis = this.analysis(context, collected.declarations);
		for (const node of collected.switches) {
			analysis.append_switch(node, context);
		}
	}
}
