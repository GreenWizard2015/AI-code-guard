import type {
	FiniteVariantMembers,
	FiniteVariantSwitchSourceAnalysisContract,
} from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _lossy fallback classification_, _unmapped source lookup_. **/
export class FiniteVariantSwitchFallbackAnalysis {
	private readonly _node: ts.SwitchStatement;
	private readonly _source_members: FiniteVariantMembers;
	private readonly _target_members: FiniteVariantMembers;
	private readonly _source_name: string;
	private readonly _source_type: string;
	private readonly _target_name: string;
	private readonly _discriminant: string;

	/** Responsibilities: _tagged target classification_. **/
	private tagged_target(target_expression: ts.Expression): boolean {
		if (!ts.isObjectLiteralExpression(target_expression)) {
			return false;
		}
		for (const property of target_expression.properties) {
			if (!ts.isPropertyAssignment(property)) {
				continue;
			}
			if (property.name.getText().replaceAll(/["']/gu, "") !== this._discriminant) {
				continue;
			}
			if (ts.isStringLiteral(property.initializer)) {
				return this._target_members.has(property.initializer.text);
			}
		}
		return false;
	}

	/** Responsibilities: _fallback return expression classification_. **/
	private target_variant(fallback_value: ts.Expression): boolean {
		if (this._discriminant.length > 0) {
			return this.tagged_target(fallback_value);
		}
		if (ts.isStringLiteral(fallback_value)) {
			return this._target_members.has(fallback_value.text);
		}
		return this.target_member_access(fallback_value);
	}

	/** Responsibilities: _target member access classification_. **/
	private target_member_access(member_access: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(member_access) || !ts.isIdentifier(member_access.expression)) {
			return false;
		}
		if (member_access.expression.text !== this._target_name) {
			return false;
		}
		return this._target_members.has(member_access.name.text);
	}

	/** Responsibilities: _fallback target classification_. **/
	private fallback_targets_variant(node: ts.DefaultClause): boolean {
		if (node.statements.length !== 1) {
			return false;
		}
		const statement = node.statements[0];
		if (statement === undefined || !ts.isReturnStatement(statement)) {
			return false;
		}
		const value = statement.expression;
		return value !== undefined && this.target_variant(value);
	}

	/** Responsibilities: _source identity fallback classification_. **/
	private preserves_source(node: ts.DefaultClause): boolean {
		if (node.statements.length !== 1) {
			return false;
		}
		const statement = node.statements[0];
		if (statement === undefined || !ts.isReturnStatement(statement)) {
			return false;
		}
		const value = statement.expression;
		if (value === undefined || !ts.isIdentifier(value)) {
			return false;
		}
		return value.text === this._source_name;
	}

	/** Responsibilities: _switch case variant identity_. **/
	private case_member(node: ts.CaseClause): string {
		if (ts.isStringLiteral(node.expression)) {
			return node.expression.text;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return "";
		}
		if (!ts.isIdentifier(node.expression.expression)) {
			return "";
		}
		if (node.expression.expression.text !== this._source_type) {
			return "";
		}
		return node.expression.name.text;
	}

	/** Responsibilities: _unhandled source variant lookup_. **/
	private mapped_source_variants(): FiniteVariantMembers {
		const mapped: FiniteVariantMembers = new Set();
		for (const clause of this._node.caseBlock.clauses) {
			if (!ts.isCaseClause(clause)) {
				continue;
			}
			const member = this.case_member(clause);
			if (this._source_members.has(member)) {
				mapped.add(member);
			}
		}
		return mapped;
	}

	/** Responsibilities: _switch fallback context initialization_. **/
	public constructor(
		node: ts.SwitchStatement,
		source_analysis: FiniteVariantSwitchSourceAnalysisContract,
		source_members: FiniteVariantMembers,
		target_members: FiniteVariantMembers,
		discriminants_by_type: ReadonlyMap<string, string>,
	) {
		this._node = node;
		this._source_members = source_members;
		this._target_members = target_members;
		const owner = source_analysis.owner(node);
		this._source_name = source_analysis.source_name(node.expression);
		this._source_type = source_analysis.source_type(owner, this._source_name);
		this._target_name = source_analysis.target_type(owner);
		let target_discriminant = "";
		const discriminant = discriminants_by_type.get(this._target_name);
		if (discriminant !== undefined) {
			target_discriminant = discriminant;
		}
		this._discriminant = target_discriminant;
	}

	/** Responsibilities: _unhandled source variant lookup_. **/
	public contains_missing_mapping(): boolean {
		const mapped = this.mapped_source_variants();
		if (mapped.size === 0) {
			return false;
		}
		for (const member of this._source_members) {
			if (!mapped.has(member)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _lossy fallback selection_. **/
	public fallback_maps_variant(): boolean {
		for (const clause of this._node.caseBlock.clauses) {
			if (!ts.isDefaultClause(clause)) {
				continue;
			}
			if (this.preserves_source(clause)) {
				return false;
			}
			return this.fallback_targets_variant(clause);
		}
		return false;
	}

	/** Responsibilities: _incomplete mapping verification_. **/
	public incomplete(): boolean {
		if (!this.fallback_maps_variant()) {
			return false;
		}
		return this.contains_missing_mapping();
	}
}
