import type { StringNumberSetMap } from "src/analysis_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { TypeScriptHiddenGlobalStateIndexContract } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import ts from "typescript";

/** Responsibilities: _module collection indexing_, _shared mutation ownership_. **/
export class TypeScriptHiddenGlobalStateIndex implements TypeScriptHiddenGlobalStateIndexContract {
	private readonly _collection_mutators: ReadonlySet<string>;
	private readonly _collection_types: ReadonlySet<string>;
	private readonly _assignment_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _collections: Map<string, number>;
	private readonly _hidden_global_rule: DiagnosticRuleContract;
	private readonly _mutations_by_context: WeakMap<RuleContextContract, ts.Node[]>;

	/** Responsibilities: _collection initializer classification_. **/
	private collection_initializer(node: ts.Expression): boolean {
		if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) {
			return true;
		}
		if (!ts.isNewExpression(node) || !ts.isIdentifier(node.expression)) {
			return false;
		}
		return this._collection_types.has(node.expression.text);
	}

	/** Responsibilities: _named callable classification_. **/
	private named_callable(node: ts.SignatureDeclaration): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return true;
		}
		if (ts.isMethodDeclaration(node)) {
			return true;
		}
		if (ts.isConstructorDeclaration(node)) {
			return true;
		}
		return ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
	}

	/** Responsibilities: _collection assignment mutation_. **/
	private mutated_assignment(node: ts.BinaryExpression): string {
		if (!this._assignment_kinds.has(node.operatorToken.kind)) {
			return "";
		}
		if (!ts.isIdentifier(node.left) || !this._collections.has(node.left.text)) {
			return "";
		}
		return node.left.text;
	}

	/** Responsibilities: _collection method mutation_. **/
	private mutated_call(node: ts.CallExpression): string {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return "";
		}
		if (!ts.isIdentifier(node.expression.expression)) {
			return "";
		}
		const collection = node.expression.expression.text;
		if (!this._collections.has(collection) || !this._collection_mutators.has(node.expression.name.text)) {
			return "";
		}
		return collection;
	}

	/** Responsibilities: _collection mutation lookup_. **/
	private mutated_collection(classification_node: ts.Node): string {
		if (ts.isBinaryExpression(classification_node)) {
			return this.mutated_assignment(classification_node);
		}
		if (ts.isCallExpression(classification_node)) {
			return this.mutated_call(classification_node);
		}
		return "";
	}

	/** Responsibilities: _named callable ownership_. **/
	private append_named_owner(callable_candidate: ts.Node, owners: StringNumberSetMap, collection: string): boolean {
		if (!ts.isFunctionLike(callable_candidate) || !this.named_callable(callable_candidate)) {
			return false;
		}
		let callable_owners = owners.get(collection);
		if (callable_owners === undefined) {
			callable_owners = new Set<number>();
			owners.set(collection, callable_owners);
		}
		callable_owners.add(callable_candidate.getStart());
		return true;
	}

	/** Responsibilities: _collection callable ownership_. **/
	private append_owner(owner_lookup_target: ts.Node, owners: StringNumberSetMap, collection: string): void {
		let current = owner_lookup_target;
		while (!ts.isSourceFile(current)) {
			if (this.append_named_owner(current, owners, collection)) {
				return;
			}
			const parent = current.parent;
			if (parent === undefined) {
				return;
			}
			current = parent;
		}
	}

	/** Responsibilities: _shared collection owner discovery_. **/
	private owners(nodes: readonly ts.Node[]): StringNumberSetMap {
		const owners: StringNumberSetMap = new Map();
		for (const node of nodes) {
			const collection = this.mutated_collection(node);
			if (collection) {
				this.append_owner(node, owners, collection);
			}
		}
		return owners;
	}

	/** Responsibilities: _hidden global index configuration_. **/
	public constructor() {
		this._collection_mutators = new Set(["add", "clear", "delete", "pop", "push", "set", "shift", "splice", "unshift"]);
		this._collection_types = new Set(["Map", "Set", "WeakMap", "WeakSet"]);
		this._assignment_kinds = new Set([
			ts.SyntaxKind.EqualsToken,
			ts.SyntaxKind.PlusEqualsToken,
			ts.SyntaxKind.MinusEqualsToken,
			ts.SyntaxKind.AsteriskEqualsToken,
			ts.SyntaxKind.SlashEqualsToken,
		]);
		this._collections = new Map<string, number>();
		this._hidden_global_rule = new DiagnosticRule("hidden-global-state");
		this._mutations_by_context = new WeakMap();
	}

	/** Responsibilities: _module collection declaration accumulation_. **/
	public append_collection_declarations(statement: ts.VariableStatement, source_file: ts.SourceFile): void {
		if (statement.parent !== source_file) {
			return;
		}
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name)) {
				continue;
			}
			if (declaration.initializer === undefined) {
				continue;
			}
			if (this.collection_initializer(declaration.initializer)) {
				this._collections.set(declaration.name.text, statement.getStart(source_file));
			}
		}
	}

	/** Responsibilities: _source collection index reset_. **/
	public reset_source(): void {
		this._collections.clear();
	}

	/** Responsibilities: _source mutation node accumulation_. **/
	public append_mutation(source_accumulation_context: RuleContextContract, recorded_mutation: ts.Node): void {
		let mutations = this._mutations_by_context.get(source_accumulation_context);
		if (mutations === undefined) {
			mutations = [];
			this._mutations_by_context.set(source_accumulation_context, mutations);
		}
		mutations.push(recorded_mutation);
	}

	/** Responsibilities: _source mutation node transfer_. **/
	public take_mutations(source_take_context: RuleContextContract): ts.Node[] {
		const mutations = this._mutations_by_context.get(source_take_context) ?? [];
		this._mutations_by_context.delete(source_take_context);
		return mutations;
	}

	/** Responsibilities: _shared state violation reporting_. **/
	public report_shared_state(report_context: RuleContextContract, nodes: readonly ts.Node[]): void {
		const {
			source: { file, source_file },
		} = report_context.state();
		const owners = this.owners(nodes);
		for (const [name, callable_owners] of owners) {
			if (callable_owners.size < 2) {
				continue;
			}
			const position = this._collections.get(name);
			if (position === undefined) {
				continue;
			}
			const line = source_file.getLineAndCharacterOfPosition(position).line + 1;
			report_context.append_violation(this._hidden_global_rule.violation(file, line, {}));
		}
	}
}
