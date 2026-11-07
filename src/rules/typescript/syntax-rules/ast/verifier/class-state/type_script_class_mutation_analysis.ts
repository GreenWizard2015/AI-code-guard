import ts from "typescript";

/** Responsibilities: _readonly collection mutation analysis_, _mutable collection ownership analysis_. **/
export class TypeScriptClassMutationAnalysis {
	private readonly _declaration: ts.ClassLikeDeclaration;
	private readonly _collection_mutators: ReadonlySet<string>;
	private readonly _fields: Set<string>;
	private readonly _methods: Map<string, ts.MethodDeclaration>;
	private readonly _mutated: Set<string>;

	/** Responsibilities: _readonly field identification_. **/
	private index_readonly_fields(): void {
		for (const member of this._declaration.members) {
			if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
				continue;
			}
			if (!ts.canHaveModifiers(member)) {
				continue;
			}
			const modifiers = ts.getModifiers(member);
			if (modifiers === undefined) {
				continue;
			}
			if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)) {
				this._fields.add(member.name.text);
			}
		}
	}

	/** Responsibilities: _class method lookup_. **/
	private index_methods(): void {
		for (const member of this._declaration.members) {
			if (ts.isMethodDeclaration(member) && member.name !== undefined && ts.isIdentifier(member.name)) {
				this._methods.set(member.name.text, member);
			}
		}
	}

	/** Responsibilities: _method collection mutation parameters_. **/
	private mutating_parameters(method: ts.MethodDeclaration): ReadonlySet<string> {
		const parameters = new Set<string>();
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
				const receiver = node.expression.expression;
				if (ts.isIdentifier(receiver) && this._collection_mutators.has(node.expression.name.text)) {
					parameters.add(receiver.text);
				}
			}
			ts.forEachChild(node, visit);
		};
		if (method.body !== undefined) {
			visit(method.body);
		}
		return parameters;
	}

	/** Responsibilities: _owned field access identification_. **/
	private owned_field(expression: ts.Expression): string {
		const path: string[] = [];
		let current = expression;
		while (ts.isPropertyAccessExpression(current)) {
			path.push(current.name.text);
			current = current.expression;
		}
		if (current.kind !== ts.SyntaxKind.ThisKeyword || path.length === 0) {
			return "";
		}
		const field_name = path.at(-1);
		if (field_name === undefined) {
			return "";
		}
		return field_name;
	}

	/** Responsibilities: _owned mutable argument propagation_. **/
	private append_mutated_argument(
		argument: ts.Expression,
		parameter: ts.ParameterDeclaration,
		mutating_parameters: ReadonlySet<string>,
	): void {
		if (!ts.isIdentifier(parameter.name)) {
			return;
		}
		if (!ts.isPropertyAccessExpression(argument) || argument.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return;
		}
		const field_name = argument.name.text;
		if (this._fields.has(field_name) && mutating_parameters.has(parameter.name.text)) {
			this._mutated.add(field_name);
		}
	}

	/** Responsibilities: _method argument mutation propagation_. **/
	private append_argument_mutations(call: ts.CallExpression, method: ts.MethodDeclaration): void {
		const mutating_parameters = this.mutating_parameters(method);
		for (let index = 0; index < call.arguments.length; index += 1) {
			const argument = call.arguments[index];
			const parameter = method.parameters[index];
			if (argument === undefined || parameter === undefined) {
				continue;
			}
			this.append_mutated_argument(argument, parameter, mutating_parameters);
		}
	}

	/** Responsibilities: _internal collection mutation propagation_. **/
	private append_mutated_arguments(call: ts.CallExpression): void {
		if (!ts.isPropertyAccessExpression(call.expression)) {
			return;
		}
		if (call.expression.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return;
		}
		const method = this._methods.get(call.expression.name.text);
		if (method === undefined) {
			return;
		}
		this.append_argument_mutations(call, method);
	}

	/** Responsibilities: _direct collection mutation analysis_. **/
	private append_direct_mutation(expression: ts.Expression): void {
		if (!ts.isPropertyAccessExpression(expression)) {
			return;
		}
		const field_name = this.owned_field(expression.expression);
		if (this._fields.has(field_name) && this._collection_mutators.has(expression.name.text)) {
			this._mutated.add(field_name);
		}
	}

	/** Responsibilities: _mutable collection field classification_. **/
	private mutable_collection_field(member: ts.Node): boolean {
		if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
			return false;
		}
		if (!this._fields.has(member.name.text)) {
			return false;
		}
		if (member.type === undefined || !ts.isTypeReferenceNode(member.type)) {
			return false;
		}
		if (!ts.isIdentifier(member.type.typeName)) {
			return false;
		}
		return member.type.typeName.text === "Map" || member.type.typeName.text === "Set";
	}

	/** Responsibilities: _mutable collection field index_. **/
	private mutable_collection_fields(): ReadonlySet<string> {
		const mutable_fields = new Set<string>();
		for (const member of this._declaration.members) {
			if (!this.mutable_collection_field(member)) {
				continue;
			}
			if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
				mutable_fields.add(member.name.text);
			}
		}
		return mutable_fields;
	}

	/** Responsibilities: _constructor collection ownership transfer_. **/
	private append_mutable_arguments(call: ts.NewExpression): void {
		if (call.arguments === undefined) {
			return;
		}
		const mutable_fields = this.mutable_collection_fields();
		for (const argument of call.arguments) {
			const field_name = this.owned_field(argument);
			if (mutable_fields.has(field_name)) {
				this._mutated.add(field_name);
			}
		}
	}

	/** Responsibilities: _class mutation analysis initialization_. **/
	public constructor(declaration: ts.ClassLikeDeclaration, collection_mutators: ReadonlySet<string>) {
		this._declaration = declaration;
		this._collection_mutators = collection_mutators;
		this._fields = new Set<string>();
		this._methods = new Map<string, ts.MethodDeclaration>();
		this._mutated = new Set<string>();
	}

	/** Responsibilities: _immutable field index_. **/
	public immutable_fields(): ReadonlySet<string> {
		this.index_readonly_fields();
		return this._fields;
	}

	/** Responsibilities: _readonly field mutation analysis_. **/
	public mutated_fields(): ReadonlySet<string> {
		this.index_readonly_fields();
		this.index_methods();
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				this.append_mutated_arguments(node);
				this.append_direct_mutation(node.expression);
			}
			if (ts.isNewExpression(node)) {
				this.append_mutable_arguments(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(this._declaration);
		return this._mutated;
	}
}
