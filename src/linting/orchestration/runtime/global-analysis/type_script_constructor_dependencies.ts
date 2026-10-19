import ts from "typescript";
import type { ReadonlyStringSetMap, StringReadonlySetMap } from "src/protocols";

/** Responsibilities: _constructor dependency extraction_, _field dependency inference_. **/
export class TypeScriptConstructorDependencies {
	private readonly expression_cache: WeakMap<ts.Node, string[]>;
	private readonly known_classes: ReadonlySet<string>;
	private readonly empty_field_types: ReadonlySet<string>;

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
		if (this.known_classes.has(name)) {
			return true;
		}
		const separator = name.indexOf(".");
		if (separator <= 0) {
			return false;
		}
		return this.known_classes.has(name.slice(0, separator));
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

	/** Responsibilities: _constructor assignment field types_. **/
	private assignment_field_types(
		node: ts.BinaryExpression,
		fields: ReadonlyStringSetMap,
	): ReadonlySet<string> {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return this.empty_field_types;
		}
		if (!ts.isPropertyAccessExpression(node.left)) {
			return this.empty_field_types;
		}
		if (node.left.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return this.empty_field_types;
		}
		const field_types = fields.get(node.left.name.text);
		if (field_types !== undefined) {
			return field_types;
		}
		return this.empty_field_types;
	}

	/** Responsibilities: _constructor assignment dependency_. **/
	private append_assignment_dependency(
		node: ts.BinaryExpression,
		fields: ReadonlyStringSetMap,
		dependencies: string[],
	): void {
		const field_types = this.assignment_field_types(node, fields);
		for (const dependency of this.collect_new_expressions(node.right)) {
			if (field_types.has(dependency)) {
				dependencies.push(dependency);
			}
		}
	}

	/** Responsibilities: _constructor field assignment collection_. **/
	private append_assignments(
		node: ts.Node,
		fields: ReadonlyStringSetMap,
		dependencies: string[],
	): void {
		if (ts.isBinaryExpression(node)) {
			this.append_assignment_dependency(node, fields, dependencies);
		}
		node.forEachChild((child) => this.append_assignments(child, fields, dependencies));
	}

	/** Responsibilities: _constructor dependency filtering_. **/
	private assigned_dependencies(
		node: ts.ConstructorDeclaration,
		fields: ReadonlyStringSetMap,
	): string[] {
		const dependencies: string[] = [];
		if (node.body === undefined) {
			return dependencies;
		}
		for (const statement of node.body.statements) {
			this.append_assignments(statement, fields, dependencies);
		}
		return dependencies.filter((dependency) => this.known_class_dependency(dependency));
	}

	/** Responsibilities: _single subtree construction traversal_. **/
	private collect_node(node: ts.Node, dependencies: string[]): void {
		if (ts.isNewExpression(node)) {
			const name = this.construction_name(node.expression);
			if (name.length > 0) {
				dependencies.push(name);
			}
		}
		node.forEachChild((child) => this.collect_node(child, dependencies));
	}

	/** Responsibilities: _known class scope_. **/
	public constructor(known_classes: ReadonlySet<string>) {
		this.expression_cache = new WeakMap<ts.Node, string[]>();
		this.known_classes = known_classes;
		this.empty_field_types = new Set<string>();
	}

	/** Responsibilities: _nested constructor expression collection_. **/
	public collect_new_expressions(node: ts.Node): string[] {
		const cached = this.expression_cache.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const dependencies: string[] = [];
		this.collect_node(node, dependencies);
		this.expression_cache.set(node, dependencies);
		return dependencies;
	}

	/** Responsibilities: _constructor-owned dependency collection_. **/
	public constructor_dependencies(node: ts.ClassLikeDeclaration): string[] {
		const fields = this.uninitialized_fields(node);
		const dependencies: string[] = [];
		for (const member of node.members) {
			if (ts.isConstructorDeclaration(member)) {
				dependencies.push(...this.assigned_dependencies(member, fields));
			}
		}
		return dependencies;
	}

}
