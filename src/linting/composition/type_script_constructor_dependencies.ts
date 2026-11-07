import type { ReadonlyStringSetMap, StringReadonlySetMap } from "src/analysis_types";
import type { TypeScriptConstructorDependenciesContract } from "src/contracts/protocols/composition_protocols";
import ts from "typescript";

/** Responsibilities: _constructor dependency extraction_, _field dependency inference_. **/
export class TypeScriptConstructorDependencies implements TypeScriptConstructorDependenciesContract {
	private readonly _expression_cache: WeakMap<ts.Node, string[]>;
	private readonly _known_classes: ReadonlySet<string>;

	/** Responsibilities: _construction expression name_. **/
	private construction_name(expression: ts.Expression): string {
		if (ts.isIdentifier(expression)) {
			return expression.text;
		}
		if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
			return `${expression.expression.text}.${expression.name.text}`;
		}
		return "";
	}

	/** Responsibilities: _field type names_. **/
	private field_type_names(type: ts.TypeNode): ReadonlySet<string> {
		const names = new Set<string>();
		if (!ts.isTypeReferenceNode(type)) {
			return names;
		}
		if (ts.isIdentifier(type.typeName)) {
			names.add(type.typeName.text);
		} else if (ts.isQualifiedName(type.typeName) && ts.isIdentifier(type.typeName.left)) {
			names.add(`${type.typeName.left.text}.${type.typeName.right.text}`);
		}
		return names;
	}

	/** Responsibilities: _known construction dependency check_. **/
	private known_class_dependency(name: string): boolean {
		if (this._known_classes.has(name)) {
			return true;
		}
		const separator = name.indexOf(".");
		if (separator <= 0) {
			return false;
		}
		return this._known_classes.has(name.slice(0, separator));
	}

	/** Responsibilities: _typed field registration_. **/
	private append_field(fields: StringReadonlySetMap, member: ts.PropertyDeclaration): void {
		if (member.initializer !== undefined) {
			return;
		}
		if (!ts.isIdentifier(member.name)) {
			return;
		}
		const field_types = new Set<string>();
		if (member.type !== undefined) {
			for (const name of this.field_type_names(member.type)) {
				field_types.add(name);
			}
		}
		fields.set(member.name.text, field_types);
	}

	/** Responsibilities: _uninitialized typed fields_. **/
	private uninitialized_fields(node: ts.ClassLikeDeclaration): StringReadonlySetMap {
		const fields: StringReadonlySetMap = new Map();
		for (const member of node.members) {
			if (!ts.isPropertyDeclaration(member)) {
				continue;
			}
			this.append_field(fields, member);
		}
		return fields;
	}

	/** Responsibilities: _constructor assignment field name_. **/
	private assigned_field_name(node: ts.BinaryExpression): string {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return "";
		}
		if (!ts.isPropertyAccessExpression(node.left)) {
			return "";
		}
		if (node.left.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return "";
		}
		return node.left.name.text;
	}

	/** Responsibilities: _constructor field assignments_. **/
	private assignment_dependencies_for(node: ts.BinaryExpression, fields: ReadonlyStringSetMap): string[] {
		const dependencies: string[] = [];
		const field_types = fields.get(this.assigned_field_name(node));
		if (field_types === undefined) {
			return dependencies;
		}
		for (const dependency of this.collect_new_expressions(node.right)) {
			if (field_types.has(dependency)) {
				dependencies.push(dependency);
			}
		}
		return dependencies;
	}

	/** Responsibilities: _constructor assignment traversal_. **/
	private assignment_dependencies(node: ts.Node, fields: ReadonlyStringSetMap): string[] {
		const dependencies: string[] = [];
		if (ts.isBinaryExpression(node)) {
			dependencies.push(...this.assignment_dependencies_for(node, fields));
		}
		node.forEachChild((child) => {
			dependencies.push(...this.assignment_dependencies(child, fields));
		});
		return dependencies;
	}

	/** Responsibilities: _single subtree construction traversal_. **/
	private collect_node(expression_node: ts.Node, expression_names: string[]): void {
		if (ts.isNewExpression(expression_node)) {
			const name = this.construction_name(expression_node.expression);
			if (name.length > 0) {
				expression_names.push(name);
			}
		}
		expression_node.forEachChild((child) => this.collect_node(child, expression_names));
	}

	/** Responsibilities: _known class scope_. **/
	public constructor(known_classes: ReadonlySet<string>) {
		this._expression_cache = new WeakMap<ts.Node, string[]>();
		this._known_classes = known_classes;
	}

	/** Responsibilities: _nested constructor expression collection_. **/
	public collect_new_expressions(expression_root: ts.Node): string[] {
		const cached = this._expression_cache.get(expression_root);
		if (cached !== undefined) {
			return cached;
		}
		const expression_names: string[] = [];
		this.collect_node(expression_root, expression_names);
		this._expression_cache.set(expression_root, expression_names);
		return expression_names;
	}

	/** Responsibilities: _constructor-owned dependency collection_. **/
	public constructor_dependencies(node: ts.ClassLikeDeclaration): string[] {
		const fields = this.uninitialized_fields(node);
		const dependencies: string[] = [];
		for (const member of node.members) {
			if (ts.isConstructorDeclaration(member) && member.body !== undefined) {
				dependencies.push(...this.assignment_dependencies(member.body, fields));
			}
		}
		return dependencies.filter((dependency) => this.known_class_dependency(dependency));
	}
}
