import { AstPropertyBindingIndex } from "src/model/ast/ast_property_binding_index";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { SourceFileDeclarationCache, SourceFileDeclarationMap } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _shared source declarations_, _shared lexical bindings_. **/
export class AstPropertySourceIndexCache implements AstPropertySourceIndexContract {
	private readonly _declarations: SourceFileDeclarationCache;
	private readonly _registered: WeakSet<ts.SourceFile>;
	private readonly _property_bindings: AstPropertyBindingIndex;

	/** Responsibilities: _source declaration registration_. **/
	private register_declarations(source: ts.SourceFile): SourceFileDeclarationMap {
		const declarations = new Map<string, ts.Declaration>();
		const visit = (node: ts.Node): void => {
			if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
				declarations.set(`${source.fileName}\u0000${node.name.text}`, node);
			}
			this._property_bindings.register(source, node);
			ts.forEachChild(node, visit);
		};
		visit(source);
		return declarations;
	}

	/** Responsibilities: _shared source index initialization_. **/
	public constructor() {
		this._declarations = new WeakMap<ts.SourceFile, SourceFileDeclarationMap>();
		this._registered = new WeakSet<ts.SourceFile>();
		this._property_bindings = new AstPropertyBindingIndex();
	}

	/** Responsibilities: _indexed binding type resolution_. **/
	public type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode {
		const source = identifier.getSourceFile();
		if (!this._registered.has(source)) {
			this.declarations_for(source);
		}
		return this._property_bindings.type(identifier, unknown_type);
	}

	/** Responsibilities: _source index reuse_. **/
	public declarations_for(source: ts.SourceFile): ReadonlyMap<string, ts.Declaration> {
		if (!this._registered.has(source)) {
			this._declarations.set(source, this.register_declarations(source));
			this._registered.add(source);
		}
		const declarations = this._declarations.get(source);
		if (declarations !== undefined) {
			return declarations;
		}
		return new Map<string, ts.Declaration>();
	}
}
