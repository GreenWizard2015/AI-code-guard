import { JestExecutionRegion } from "src/jest_execution_region";
import type { JestBindingIndexContract } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _mutable state classification_, _mutation detection_. **/
export class JestModuleState {
	private readonly _shared_mutation_methods: ReadonlySet<string>;
	private readonly _bindings: JestBindingIndexContract;
	private readonly _module_declarations: Set<ts.Declaration>;

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
	private append_assignment_mutation(mutations: Set<string>, assignment: ts.Node): void {
		if (!ts.isBinaryExpression(assignment)) {
			return;
		}
		const operator_kind = assignment.operatorToken.kind;
		if (operator_kind < ts.SyntaxKind.FirstAssignment || operator_kind > ts.SyntaxKind.LastAssignment) {
			return;
		}
		if (ts.isIdentifier(assignment.left)) {
			if (this._bindings.binding_is(assignment.left, this._module_declarations)) {
				mutations.add(assignment.left.text);
			}
		}
	}

	/** Responsibilities: _mutation target collection_. **/
	private append_call_mutation(mutations: Set<string>, call_candidate: ts.Node): void {
		if (!ts.isCallExpression(call_candidate) || !ts.isPropertyAccessExpression(call_candidate.expression)) {
			return;
		}
		let owner = call_candidate.expression.expression;
		while (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner)) {
			owner = owner.expression;
		}
		if (!ts.isIdentifier(owner)) {
			return;
		}
		const module_binding = this._bindings.binding_is(owner, this._module_declarations);
		const mutation_method = this._shared_mutation_methods.has(call_candidate.expression.name.text);
		if (module_binding && mutation_method) {
			mutations.add(owner.text);
		}
	}

	/** Responsibilities: _module state initialization_. **/
	public constructor(shared_mutation_methods: ReadonlySet<string>, bindings: JestBindingIndexContract) {
		this._shared_mutation_methods = shared_mutation_methods;
		this._bindings = bindings;
		this._module_declarations = new Set<ts.Declaration>();
	}

	/** Responsibilities: _mutable module declaration collection_. **/
	public declarations(source_file: ts.SourceFile): ReadonlySet<ts.Declaration> {
		for (const statement of source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && this.mutable_declaration(statement, declaration)) {
					this._module_declarations.add(declaration);
				}
			}
		}
		return this._module_declarations;
	}

	/** Responsibilities: _module state mutations_. **/
	public mutations(module_scope: ts.Node): ReadonlySet<string> {
		const mutations = new Set<string>();
		const region = new JestExecutionRegion(module_scope, (current) => {
			this.append_assignment_mutation(mutations, current);
			this.append_call_mutation(mutations, current);
		});
		region.visit();
		return mutations;
	}
}
