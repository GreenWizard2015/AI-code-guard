import ts from "typescript";
import { AstPropertyBindingIndex } from "src/ast_property_binding_index";
import type { AstPropertySourceIndexContract, SourceFileDeclarationCache, SourceFileDeclarationMap } from "src/protocols";

/** Responsibilities: _shared source declarations_, _shared lexical bindings_. **/
export class AstPropertySourceIndexCache implements AstPropertySourceIndexContract {
	private readonly declarations: SourceFileDeclarationCache;
	private readonly registered: WeakSet<ts.SourceFile>;
	private readonly property_bindings: AstPropertyBindingIndex;

	/** Responsibilities: _source declaration registration_. **/
	private register_declarations(source: ts.SourceFile): SourceFileDeclarationMap {
		const declarations = new Map<string, ts.Declaration>();
		const visit = (node: ts.Node): void => {
			if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
				declarations.set(`${source.fileName}\u0000${node.name.text}`, node);
			}
			this.property_bindings.register(source, node);
			ts.forEachChild(node, visit);
		};
		visit(source);
		return declarations;
	}

	/** Responsibilities: _shared source index initialization_. **/
	public constructor() {
		this.declarations = new WeakMap<ts.SourceFile, SourceFileDeclarationMap>();
		this.registered = new WeakSet<ts.SourceFile>();
		this.property_bindings = new AstPropertyBindingIndex();
	}

	/** Responsibilities: _indexed binding type resolution_. **/
	public type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode {
		const source = identifier.getSourceFile();
		if (!this.registered.has(source)) {
			this.declarations_for(source);
		}
		return this.property_bindings.type(identifier, unknown_type);
	}

	/** Responsibilities: _source index reuse_. **/
	public declarations_for(source: ts.SourceFile): ReadonlyMap<string, ts.Declaration> {
		if (!this.registered.has(source)) {
			this.declarations.set(source, this.register_declarations(source));
			this.registered.add(source);
		}
		const declarations = this.declarations.get(source);
		if (declarations !== undefined) {
			return declarations;
		}
		return new Map<string, ts.Declaration>();
	}

}
