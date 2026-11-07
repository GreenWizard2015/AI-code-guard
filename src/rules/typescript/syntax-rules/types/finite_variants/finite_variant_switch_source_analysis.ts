import type {
	FiniteVariantMembers,
	FiniteVariantSwitchSourceAnalysisContract,
} from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _switch source type resolution_, _variant source lookup_. **/
export class FiniteVariantSwitchSourceAnalysis implements FiniteVariantSwitchSourceAnalysisContract {
	private readonly _members_by_type: ReadonlyMap<string, FiniteVariantMembers>;
	private readonly _discriminants_by_type: ReadonlyMap<string, string>;

	/** Responsibilities: _named type resolution_. **/
	private named_type(node: ts.TypeNode): string {
		if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName)) {
			return "";
		}
		return node.typeName.text;
	}

	/** Responsibilities: _switch discriminator extraction_. **/
	private source_expression_discriminant(node: ts.Expression): string {
		if (!ts.isPropertyAccessExpression(node)) {
			return "";
		}
		return node.name.text;
	}

	/** Responsibilities: _source discriminant matching_. **/
	private matches_source_discriminant(source_type: string, expression: ts.Expression): boolean {
		const discriminant = this._discriminants_by_type.get(source_type);
		if (discriminant === undefined) {
			return ts.isIdentifier(expression);
		}
		return this.source_expression_discriminant(expression) === discriminant;
	}

	/** Responsibilities: _switch source dependency initialization_. **/
	public constructor(
		members_by_type: ReadonlyMap<string, FiniteVariantMembers>,
		discriminants_by_type: ReadonlyMap<string, string>,
	) {
		this._members_by_type = members_by_type;
		this._discriminants_by_type = discriminants_by_type;
	}

	/** Responsibilities: _callable source parameter type_. **/
	public source_type(callable_owner: ts.Node, parameter_name: string): string {
		if (!ts.isFunctionLike(callable_owner)) {
			return "";
		}
		for (const parameter of callable_owner.parameters) {
			if (!ts.isIdentifier(parameter.name) || parameter.name.text !== parameter_name) {
				continue;
			}
			if (parameter.type === undefined) {
				return "";
			}
			return this.named_type(parameter.type);
		}
		return "";
	}

	/** Responsibilities: _callable result type resolution_. **/
	public target_type(returning_callable: ts.Node): string {
		if (!ts.isFunctionLike(returning_callable) || returning_callable.type === undefined) {
			return "";
		}
		return this.named_type(returning_callable.type);
	}

	/** Responsibilities: _nearest callable ownership_. **/
	public owner(node: ts.Node): ts.Node {
		let current = node.parent;
		while (current !== undefined) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return node.getSourceFile();
	}

	/** Responsibilities: _switch source binding extraction_. **/
	public source_name(node: ts.Expression): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
			return node.expression.text;
		}
		return "";
	}

	/** Responsibilities: _source variants for switch_. **/
	public source_variants(node: ts.SwitchStatement, owner: ts.Node): FiniteVariantMembers {
		const source_name = this.source_name(node.expression);
		if (source_name.length === 0) {
			return new Set();
		}
		const source_type = this.source_type(owner, source_name);
		const members = this._members_by_type.get(source_type);
		if (members === undefined || !this.matches_source_discriminant(source_type, node.expression)) {
			return new Set();
		}
		return members;
	}
}
