import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { StringNumberSetMap, ViolationContract } from "src/protocols";

/** Responsibilities: _module collection discovery_, _shared state mutation detection_. **/
export class TypeScriptHiddenGlobalState {
	private readonly source_file: ts.SourceFile;
	private readonly collection_mutators: ReadonlySet<string>;
	private readonly collection_types: ReadonlySet<string>;
	private readonly assignment_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _module collection declaration accumulation_. **/
	private append_collection_declarations(collections: Map<string, number>): void {
		for (const statement of this.source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) {
					continue;
				}
				if (declaration.initializer === undefined) {
					continue;
				}
				if (this.collection_initializer(declaration.initializer)) {
					collections.set(declaration.name.text, statement.getStart(this.source_file));
				}
			}
		}
	}

	/** Responsibilities: _collection initializer classification_. **/
	private collection_initializer(node: ts.Expression): boolean {
		if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) {
			return true;
		}
		if (!ts.isNewExpression(node) || !ts.isIdentifier(node.expression)) {
			return false;
		}
		return this.collection_types.has(node.expression.text);
	}

	/** Responsibilities: _named callable classification_. **/
	private named_callable(node: ts.Node): boolean {
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

	/** Responsibilities: _collection mutation detection_. **/
	private mutated_assignment(node: ts.Node, collections: ReadonlyMap<string, number>): string {
		if (!ts.isBinaryExpression(node) || !this.assignment_kinds.has(node.operatorToken.kind)) {
			return "";
		}
		if (!ts.isIdentifier(node.left) || !collections.has(node.left.text)) {
			return "";
		}
		return node.left.text;
	}

	/** Responsibilities: _collection mutation_. **/
	private mutated_call(node: ts.Node, collections: ReadonlyMap<string, number>): string {
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return "";
		}
		if (!ts.isIdentifier(node.expression.expression)) {
			return "";
		}
		const collection = node.expression.expression.text;
		if (!collections.has(collection) || !this.collection_mutators.has(node.expression.name.text)) {
			return "";
		}
		return collection;
	}

	/** Responsibilities: _collection mutation detection_. **/
	private mutated_collection(node: ts.Node, collections: ReadonlyMap<string, number>): string {
		const assignment = this.mutated_assignment(node, collections);
		if (assignment) {
			return assignment;
		}
		return this.mutated_call(node, collections);
	}

	/** Responsibilities: _callable collection mutation lookup_. **/
	private callable_mutations(node: ts.Node, collections: ReadonlyMap<string, number>): Set<string> {
		const mutations = new Set<string>();
		const visit = (current: ts.Node): void => {
			if (current !== node) {
				if (this.named_callable(current)) {
					return;
				}
			}
			const name = this.mutated_collection(current, collections);
			if (name) {
				mutations.add(name);
			}
			current.forEachChild(visit);
		};
		visit(node);
		return mutations;
	}

	/** Responsibilities: _shared collection owner discovery_. **/
	private owners(collections: ReadonlyMap<string, number>): StringNumberSetMap {
		const owners: StringNumberSetMap = new Map();
		const visit = (node: ts.Node): void => {
			if (this.named_callable(node)) {
				const mutations = this.callable_mutations(node, collections);
				for (const name of collections.keys()) {
					if (!mutations.has(name)) {
						continue;
					}
					let callable_owners = owners.get(name);
					if (callable_owners === undefined) {
						callable_owners = new Set<number>();
						owners.set(name, callable_owners);
					}
					callable_owners.add(node.getStart(this.source_file));
				}
			}
			node.forEachChild(visit);
		};
		visit(this.source_file);
		return owners;
	}

	/** Responsibilities: _module collection declarations_. **/
	private collection_declarations(): Map<string, number> {
		const collections = new Map<string, number>();
		this.append_collection_declarations(collections);
		return collections;
	}

	/** Responsibilities: _hidden state analyzer initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.collection_mutators = new Set([
			"add", "clear", "delete", "pop", "push", "set", "shift", "splice", "unshift",
		]);
		this.collection_types = new Set(["Map", "Set", "WeakMap", "WeakSet"]);
		this.assignment_kinds = new Set([
			ts.SyntaxKind.EqualsToken,
			ts.SyntaxKind.PlusEqualsToken,
			ts.SyntaxKind.MinusEqualsToken,
			ts.SyntaxKind.AsteriskEqualsToken,
			ts.SyntaxKind.SlashEqualsToken,
		]);
	}

	/** Responsibilities: _shared collection presence_. **/
	public collections_present(): boolean {
		return this.collection_declarations().size > 0;
	}

	/** Responsibilities: _shared module state violations_. **/
	public append(violations: ViolationContract[], file: string): void {
		const collections = this.collection_declarations();
		const owners = this.owners(collections);
		const rule = new DiagnosticRule("hidden-global-state");
		for (const [name, callable_owners] of owners) {
			if (callable_owners.size < 2) {
				continue;
			}
			const position = collections.get(name);
			if (position === undefined) {
				continue;
			}
			violations.push(rule.violation(file, this.source_file.getLineAndCharacterOfPosition(position).line + 1, {}));
		}
	}

}
