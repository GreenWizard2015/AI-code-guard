import { COLLECTION_TYPE_NAMES } from "src/constants";
import { LexicalBindingScope } from "src/parser/typescript-aliases/lexical_binding_scope";
import type { DynamicBindingNamesContract } from "src/shared_services_protocols";
import type { SourceFileStringSetCache } from "src/source_types";
import type { LexicalBindingScopeContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _dynamic string binding resolution_, _collection name indexing_. **/
export class DynamicBindingNames implements DynamicBindingNamesContract {
	private readonly _known_collection_names: Set<string>;
	private readonly _collection_name_cache: SourceFileStringSetCache;
	private readonly _lexical_scope_cache: WeakMap<ts.SourceFile, LexicalBindingScopeContract>;

	/** Responsibilities: _lexical scope cache lookup_. **/
	private lexical_scope(node: ts.Node): LexicalBindingScopeContract {
		const source_file = node.getSourceFile();
		let scope = this._lexical_scope_cache.get(source_file);
		if (scope === undefined) {
			scope = new LexicalBindingScope(source_file);
			this._lexical_scope_cache.set(source_file, scope);
		}
		return scope;
	}

	/** Responsibilities: _collection type identity_. **/
	private collection_type(type: ts.TypeNode): boolean {
		if (!ts.isTypeReferenceNode(type)) {
			return false;
		}
		if (!ts.isIdentifier(type.typeName)) {
			return false;
		}
		const name = type.typeName.text;
		if (!this._known_collection_names.has(name)) {
			return false;
		}
		return !this.lexical_scope(type).type_name_shadowed(type, name);
	}

	/** Responsibilities: _collection names declared key_. **/
	private collect_collection_names(node: ts.Node, names: Set<string>): void {
		let name = "";
		if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && node.type !== undefined) {
			name = this.collection_named_binding(node.name, node.type);
		} else if ((ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) && node.type !== undefined) {
			name = this.collection_named_binding(node.name, node.type);
		}
		if (name.length > 0) {
			names.add(name);
		}
		ts.forEachChild(node, (child) => this.collect_collection_names(child, names));
	}

	/** Responsibilities: _resolution collection binding named_. **/
	private collection_named_binding(name: ts.Node, type: ts.TypeNode): string {
		if (!ts.isIdentifier(name)) {
			return "";
		}
		if (!this.collection_type(type)) {
			return "";
		}
		return name.text;
	}

	/** Responsibilities: _reporting expression known dynamic_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._known_collection_names = new Set(COLLECTION_TYPE_NAMES);
		this._collection_name_cache = new WeakMap<ts.SourceFile, ReadonlySet<string>>();
		this._lexical_scope_cache = new WeakMap<ts.SourceFile, LexicalBindingScopeContract>();
	}
	/** Responsibilities: _public operation_. **/
	public collection_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached_names = this._collection_name_cache.get(source_file);
		if (cached_names !== undefined) {
			return cached_names;
		}
		const names = new Set<string>();
		this.collect_collection_names(source_file, names);
		this._collection_name_cache.set(source_file, names);
		return names;
	}

	/** Responsibilities: _collection expression recognition_. **/
	public collection(expression: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isNewExpression(expression)) {
			if (!ts.isIdentifier(expression.expression)) {
				return false;
			}
			const name = expression.expression.text;
			if (!this._known_collection_names.has(name)) {
				return false;
			}
			return !this.lexical_scope(expression).value_name_shadowed(expression, name);
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.collection_names(source_file).has(expression.text);
	}
}
