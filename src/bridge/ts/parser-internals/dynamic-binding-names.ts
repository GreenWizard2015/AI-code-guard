import ts from 'typescript';

/** Responsibilities: _collection statically known dynamic_. **/
export class DynamicBindingNames {
	private readonly string_key_cache = new WeakMap<ts.SourceFile, ReadonlySet<string>>();
	private readonly collection_names = new Set(['Map', 'ReadonlyMap', 'Set', 'ReadonlySet', 'WeakMap', 'WeakSet']);
	private readonly collection_name_cache = new WeakMap<ts.SourceFile, ReadonlySet<string>>();

	/** Responsibilities: _aggregation literal key names_. **/
	private append_key_names(node: ts.Node, names: Set<string>): void {
		const name = this.string_binding_name(node);
		if (name.length > 0) {
			names.add(name);
		}
		ts.forEachChild(node, child => this.append_key_names(child, names));
	}

	/** Responsibilities: _resolution name bound string-valued_. **/
	private string_binding_name(node: ts.Node): string {
		if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
			if (node.type === undefined) {
				return '';
			}
			return this.string_named_binding(node.name, node.type);
		}
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.type === undefined) {
				return '';
			}
			return this.string_named_binding(node.name, node.type);
		}
		return '';
	}

	/** Responsibilities: _resolution string binding named_. **/
	private string_named_binding(name: ts.Node, type: ts.TypeNode): string {
		if (!ts.isIdentifier(name)) {
			return '';
		}
		if (type.kind !== ts.SyntaxKind.StringKeyword) {
			return '';
		}
		return name.text;
	}

	/** Responsibilities: _collection names declared string_. **/
	private string_key_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached_names = this.string_key_cache.get(source_file);
		if (cached_names !== undefined) {
			return cached_names;
		}
		const names = new Set<string>();
		this.append_key_names(source_file, names);
		this.string_key_cache.set(source_file, names);
		return names;
	}

	/** Responsibilities: _identification collection types indexing_. **/
	private collection_type(type: ts.TypeNode): boolean {
		if (!ts.isTypeReferenceNode(type)) {
			return false;
		}
		if (!ts.isIdentifier(type.typeName)) {
			return false;
		}
		return this.collection_names.has(type.typeName.text);
	}

	/** Responsibilities: _collection names declared key_. **/
	private collect_collection_names(node: ts.Node, names: Set<string>): void {
		const name = this.collection_binding_name(node);
		if (name.length > 0) {
			names.add(name);
		}
		ts.forEachChild(node, child => this.collect_collection_names(child, names));
	}

	/** Responsibilities: _resolution name bound collection-valued_. **/
	private collection_binding_name(node: ts.Node): string {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			if (node.type === undefined) {
				return '';
			}
			return this.collection_named_binding(node.name, node.type);
		}
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.type === undefined) {
				return '';
			}
			return this.collection_named_binding(node.name, node.type);
		}
		return '';
	}

	/** Responsibilities: _resolution collection binding named_. **/
	private collection_named_binding(name: ts.Node, type: ts.TypeNode): string {
		if (!ts.isIdentifier(name)) {
			return '';
		}
		if (!this.collection_type(type)) {
			return '';
		}
		return name.text;
	}

	/** Responsibilities: _collection statically known collection_. **/
	private collection_names_in(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached_names = this.collection_name_cache.get(source_file);
		if (cached_names !== undefined) {
			return cached_names;
		}
		const names = new Set<string>();
		this.collect_collection_names(source_file, names);
		this.collection_name_cache.set(source_file, names);
		return names;
	}

	/** Responsibilities: _reporting expression known dynamic_. **/
	public collection(expression: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isNewExpression(expression)) {
			if (!ts.isIdentifier(expression.expression)) {
				return false;
			}
			return this.collection_names.has(expression.expression.text);
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.collection_names_in(source_file).has(expression.text);
	}

	/** Responsibilities: _reporting node usage key_. **/
	public dynamic_key(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		if (ts.isCallExpression(node.expression)) {
			return false;
		}
		if (ts.isNewExpression(node.expression)) {
			return false;
		}
		const key = node.argumentExpression;
		if (!ts.isIdentifier(key)) {
			return false;
		}
		return this.string_key_names(source_file).has(key.text);
	}
}
