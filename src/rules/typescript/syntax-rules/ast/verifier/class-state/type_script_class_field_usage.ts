import { TypeScriptClassDecisionFields } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_decision_fields";
import type {
	CallableTypeScriptAstNodeAction,
	TypeScriptClassFieldAnalysisContract,
	TypeScriptClassFieldReadIndex,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _field usage_, _field type analysis_. **/
export class TypeScriptClassFieldUsage implements TypeScriptClassFieldAnalysisContract {
	private readonly _declaration: ts.ClassLikeDeclaration;
	private readonly _used_fields: Set<string>;
	private readonly _decision_fields: TypeScriptClassDecisionFields;

	/** Responsibilities: _destructured field usage_. **/
	private index_destructured_reads(declaration: ts.VariableDeclaration): void {
		if (!ts.isObjectBindingPattern(declaration.name)) {
			return;
		}
		const initializer = declaration.initializer;
		if (initializer === undefined || initializer.kind !== ts.SyntaxKind.ThisKeyword) {
			return;
		}
		const scope = this.binding_scope(declaration);
		for (const element of declaration.name.elements) {
			this.index_destructured_element(element, scope);
		}
	}

	/** Responsibilities: _destructured element indexing_. **/
	private index_destructured_element(element: ts.BindingElement, scope: ts.Node): void {
		if (!ts.isIdentifier(element.name)) {
			return;
		}
		const field_name = element.propertyName;
		if (field_name !== undefined && !ts.isIdentifier(field_name)) {
			return;
		}
		let field = element.name.text;
		if (field_name !== undefined) {
			field = field_name.text;
		}
		if (this.binding_is_used(scope, element.name)) {
			this._used_fields.add(field);
		}
	}

	/** Responsibilities: _local binding scope lookup_. **/
	private binding_scope(declaration: ts.VariableDeclaration): ts.Node {
		let current: ts.Node | undefined = declaration.parent;
		while (current !== undefined) {
			if (ts.isFunctionLike(current) || ts.isClassLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return this._declaration;
	}

	/** Responsibilities: _destructured binding usage detection_. **/
	private binding_is_used(scope: ts.Node, binding: ts.Identifier): boolean {
		let used = false;
		this.visit(scope, (node) => {
			if (!ts.isIdentifier(node)) {
				return;
			}
			if (node.text !== binding.text) {
				return;
			}
			used = this.record_binding_use(node, used);
		});
		return used;
	}

	/** Responsibilities: _binding usage index_. **/
	private record_binding_use(node: ts.Identifier, used: boolean): boolean {
		if (this.is_binding_declaration(node)) {
			return used;
		}
		return true;
	}

	/** Responsibilities: _binding declaration exclusion_. **/
	private is_binding_declaration(identifier: ts.Identifier): boolean {
		const parent = identifier.parent;
		if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) {
			return true;
		}
		if (ts.isBindingElement(parent) && parent.name === identifier) {
			return true;
		}
		if (ts.isVariableDeclaration(parent) && parent.name === identifier) {
			return true;
		}
		return ts.isPropertyAssignment(parent) && parent.name === identifier;
	}

	/** Responsibilities: _AST node traversal_. **/
	private visit(root: ts.Node, action: CallableTypeScriptAstNodeAction): void {
		const pending: ts.Node[] = [root];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			action(node);
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
	}

	/** Responsibilities: _instance field root lookup_. **/
	private instance_field_name(expression: ts.PropertyAccessExpression): string {
		let current: ts.Expression = expression;
		let field = expression.name.text;
		while (ts.isPropertyAccessExpression(current)) {
			field = current.name.text;
			current = current.expression;
			if (current.kind === ts.SyntaxKind.ThisKeyword) {
				return field;
			}
		}
		return "";
	}

	/** Responsibilities: _assignment target recognition_. **/
	private direct_assignment_target(node: ts.PropertyAccessExpression): boolean {
		const parent = node.parent;
		if (!ts.isBinaryExpression(parent) || parent.left !== node) {
			return false;
		}
		const direct_field = node.expression.kind === ts.SyntaxKind.ThisKeyword;
		const plain_assignment = parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
		return direct_field && plain_assignment;
	}

	/** Responsibilities: _class field analysis initialization_. **/
	public constructor(declaration: ts.ClassLikeDeclaration) {
		this._declaration = declaration;
		this._used_fields = new Set();
		this._decision_fields = new TypeScriptClassDecisionFields(declaration);
	}

	/** Responsibilities: _field usage indexing_. **/
	public collect(): TypeScriptClassFieldReadIndex {
		const decisions = this._decision_fields.collect();
		this.visit(this._declaration, (node) => {
			if (ts.isVariableDeclaration(node)) {
				this.index_destructured_reads(node);
			}
			if (ts.isPropertyAccessExpression(node)) {
				const field = this.instance_field_name(node);
				if (field.length > 0 && !this.direct_assignment_target(node)) {
					this._used_fields.add(field);
				}
			}
		});
		return {
			used_fields: this._used_fields,
			decision_fields: decisions.decision_fields,
			error_context_fields: decisions.error_context_fields,
		};
	}
}
