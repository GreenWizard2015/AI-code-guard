import ts from "typescript";
import type { JestBindingIndexContract } from "src/testing_protocols";
import { JestExecutionRegion } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_execution_region";

/** Responsibilities: _mutable state classification_, _mutation detection_. **/
export class JestModuleState {
	private readonly shared_mutation_methods: ReadonlySet<string>;

	/** Responsibilities: _mutable declaration classification_. **/
	private mutable_declaration(statement: ts.VariableStatement, declaration: ts.VariableDeclaration): boolean {
		const initializer = declaration.initializer;
		if (initializer === undefined) {
			return statement.declarationList.flags !== ts.NodeFlags.Const;
		}
		if (ts.isArrayLiteralExpression(initializer)) {
			return true;
		}
		if (ts.isObjectLiteralExpression(initializer)) {
			return true;
		}
		return ts.isNewExpression(initializer);
	}

	/** Responsibilities: _assignment mutation registration_. **/
	private append_assignment_mutation(
		mutations: Set<string>,
		node: ts.Node,
		bindings: JestBindingIndexContract,
		module_declarations: ReadonlySet<ts.Declaration>,
	): void {
		if (!ts.isBinaryExpression(node)) {
			return;
		}
		const operator_kind = node.operatorToken.kind;
		if (operator_kind < ts.SyntaxKind.FirstAssignment || operator_kind > ts.SyntaxKind.LastAssignment) {
			return;
		}
		if (ts.isIdentifier(node.left)) {
			if (bindings.binding_is(node.left, module_declarations)) {
				mutations.add(node.left.text);
			}
		}
	}

	/** Responsibilities: _mutation target collection_. **/
	private append_call_mutation(
		mutations: Set<string>,
		node: ts.Node,
		bindings: JestBindingIndexContract,
		module_declarations: ReadonlySet<ts.Declaration>,
	): void {
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return;
		}
		let owner = node.expression.expression;
		while (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner)) {
			owner = owner.expression;
		}
		if (!ts.isIdentifier(owner)) {
			return;
		}
		const module_binding = bindings.binding_is(owner, module_declarations);
		const mutation_method = this.shared_mutation_methods.has(node.expression.name.text);
		if (module_binding && mutation_method) {
			mutations.add(owner.text);
		}
	}

	/** Responsibilities: _module state initialization_. **/
	constructor() {
		this.shared_mutation_methods = new Set(["add", "delete", "push", "set", "update"]);
	}

	/** Responsibilities: _module mutable declarations_. **/
	public declarations(source_file: ts.SourceFile): ReadonlySet<ts.Declaration> {
		const declarations = new Set<ts.Declaration>();
		for (const statement of source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && this.mutable_declaration(statement, declaration)) {
					declarations.add(declaration);
				}
			}
		}
		return declarations;
	}

	/** Responsibilities: _module state mutations_. **/
	public mutations(
		node: ts.Node,
		bindings: JestBindingIndexContract,
		module_declarations: ReadonlySet<ts.Declaration>,
	): ReadonlySet<string> {
		const mutations = new Set<string>();
		const region = new JestExecutionRegion(node, (current) => {
			this.append_assignment_mutation(mutations, current, bindings, module_declarations);
			this.append_call_mutation(mutations, current, bindings, module_declarations);
		});
		region.visit();
		return mutations;
	}
}
