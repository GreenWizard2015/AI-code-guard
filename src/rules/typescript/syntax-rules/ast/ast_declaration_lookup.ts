import ts from "typescript";
import type { AstDeclarationLookupContract } from "src/protocols";

/** Responsibilities: _AST declaration lookup state_, _type and interface classification_. **/
export class AstDeclarationLookup implements AstDeclarationLookupContract {
	private readonly declarations: ReadonlyMap<string, ts.Declaration>;
	private readonly key: string;

	/** Responsibilities: _initialization declaration lookup_. **/
	public constructor(declarations: ReadonlyMap<string, ts.Declaration>, key: string) {
		this.declarations = declarations;
		this.key = key;
	}

	/** Responsibilities: _declaration presence_. **/
	public found(): boolean {
		return this.declarations.has(this.key);
	}

	/** Responsibilities: _declaration value_. **/
	public value(): ts.Declaration {
		const declaration = this.declarations.get(this.key);
		if (declaration === undefined) {
			throw new Error(`AST declaration is unavailable: ${this.key}`);
		}
		return declaration;
	}

	/** Responsibilities: _type alias declaration classification_. **/
	public type_alias(): boolean {
		return this.found() && ts.isTypeAliasDeclaration(this.value());
	}

	/** Responsibilities: _interface declaration classification_. **/
	public interface(): boolean {
		return this.found() && ts.isInterfaceDeclaration(this.value());
	}
}
