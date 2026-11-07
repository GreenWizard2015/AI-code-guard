import type {
	DowncastBranchQuery,
	DowncastQuery,
	MethodCallSearch,
} from "src/rules/typescript/syntax-rules/types/structural/type_script_downcast_protocols";
import { TypeScriptImplementedTypeIndex } from "src/rules/typescript/syntax-rules/types/structural/type_script_implemented_type_index";
import { TypeScriptLocalBindingShadowing } from "src/rules/typescript/syntax-rules/types/structural/type_script_local_binding_shadowing";
import type { TypeScriptImplementedTypeIndexContract } from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _protocol downcast analysis_, _source contract index caching_. **/
export class TypeScriptStructuralDowncast {
	private readonly _indexes: WeakMap<ts.SourceFile, TypeScriptImplementedTypeIndexContract>;
	private readonly _local_binding_shadowing: TypeScriptLocalBindingShadowing;

	/** Responsibilities: _nearest callable ownership_. **/
	private owner(guard: ts.Node): ts.Node {
		let current = guard.parent;
		while (current !== undefined) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return guard.getSourceFile();
	}

	/** Responsibilities: _callable parameter contract lookup_. **/
	private parameter_contract(owner: ts.Node, parameter_name: string): string {
		if (!ts.isFunctionLike(owner)) {
			return "";
		}
		for (const parameter of owner.parameters) {
			if (!ts.isIdentifier(parameter.name) || parameter.name.text !== parameter_name) {
				continue;
			}
			if (parameter.type === undefined || !ts.isTypeReferenceNode(parameter.type)) {
				return "";
			}
			if (!ts.isIdentifier(parameter.type.typeName)) {
				return "";
			}
			return parameter.type.typeName.text;
		}
		return "";
	}

	/** Responsibilities: _implementation-only call search_. **/
	private implementation_call(search: MethodCallSearch): boolean {
		const pending: ts.Node[] = [search.body];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			if (node !== search.body && ts.isFunctionLike(node)) {
				continue;
			}
			if (this.implementation_call_matches(node, search)) {
				return true;
			}
			node.forEachChild((child) => pending.push(child));
		}
		return false;
	}

	/** Responsibilities: _implementation-only method call matching_. **/
	private implementation_call_matches(node: ts.Node, search: MethodCallSearch): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const property = node.expression;
		if (!ts.isIdentifier(property.expression)) {
			return false;
		}
		if (property.expression.text !== search.receiver) {
			return false;
		}
		return !search.contract_members.has(property.name.text);
	}

	/** Responsibilities: _parenthesized guard removal_. **/
	private guard_expression(candidate: ts.BinaryExpression): ts.Expression {
		let expression: ts.Expression = candidate;
		while (ts.isParenthesizedExpression(expression.parent)) {
			expression = expression.parent;
		}
		return expression;
	}

	/** Responsibilities: _protocol downcast evidence evaluation_. **/
	private reports_downcast(candidate: DowncastBranchQuery): boolean {
		if (!ts.isIdentifier(candidate.condition.left) || !ts.isIdentifier(candidate.condition.right)) {
			return false;
		}
		const query: DowncastQuery = {
			...candidate,
			receiver: candidate.condition.left.text,
			implementation: candidate.condition.right.text,
		};
		return this.reports_concrete_downcast(query);
	}

	/** Responsibilities: _unshadowed contract member lookup_. **/
	private usable_contract_members(query: DowncastQuery, owner: ts.Node): ReadonlySet<string> {
		if (this._local_binding_shadowing.shadowed_local(query.condition, owner, query.receiver)) {
			return new Set();
		}
		if (this._local_binding_shadowing.shadowed_parameter(query.condition, owner, query.implementation)) {
			return new Set();
		}
		const contract = this.parameter_contract(owner, query.receiver);
		return query.index.implemented_members(query.implementation, contract);
	}

	/** Responsibilities: _concrete downcast evidence evaluation_. **/
	private reports_concrete_downcast(query: DowncastQuery): boolean {
		const owner = this.owner(query.condition);
		if (owner === query.condition.getSourceFile()) {
			return false;
		}
		const members = this.usable_contract_members(query, owner);
		if (members.size === 0) {
			return false;
		}
		return this.implementation_call({
			body: query.branch.thenStatement,
			receiver: query.receiver,
			contract_members: members,
		});
	}

	/** Responsibilities: _protocol downcast analyzer setup_. **/
	public constructor() {
		this._indexes = new WeakMap();
		this._local_binding_shadowing = new TypeScriptLocalBindingShadowing();
	}

	/** Responsibilities: _source contract membership caching_. **/
	public prepare(source_file: ts.SourceFile): TypeScriptImplementedTypeIndexContract {
		const cached = this._indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new TypeScriptImplementedTypeIndex();
		index.prepare(source_file);
		this._indexes.set(source_file, index);
		return index;
	}

	/** Responsibilities: _instanceof guard downcast analysis_. **/
	public reports(candidate: ts.Node): boolean {
		if (!ts.isBinaryExpression(candidate) || candidate.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) {
			return false;
		}
		const expression = this.guard_expression(candidate);
		const branch = expression.parent;
		if (!ts.isIfStatement(branch) || branch.expression !== expression) {
			return false;
		}
		return this.reports_downcast({
			condition: candidate,
			branch,
			index: this.prepare(candidate.getSourceFile()),
		});
	}
}
