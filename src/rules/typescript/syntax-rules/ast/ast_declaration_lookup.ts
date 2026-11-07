import type { AstDeclarationLookupContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _AST declaration lookup state_, _type and interface classification_. **/
export class AstDeclarationLookup implements AstDeclarationLookupContract {
	private readonly _declarations: ReadonlyMap<string, ts.Declaration>;
	private readonly _key: string;

	/** Responsibilities: _initialization declaration lookup_. **/
	public constructor(declarations: ReadonlyMap<string, ts.Declaration>, key: string) {
		this._declarations = declarations;
		this._key = key;
	}

	/** Responsibilities: _declaration presence_. **/
	public found(): boolean {
		return this._declarations.has(this._key);
	}

	/** Responsibilities: _declaration value_. **/
	public value(): ts.Declaration {
		const declaration = this._declarations.get(this._key);
		if (declaration === undefined) {
			throw new Error(`AST declaration is unavailable: ${this._key}`);
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
