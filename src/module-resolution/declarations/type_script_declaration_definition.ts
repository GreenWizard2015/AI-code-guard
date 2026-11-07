import type { TypeScriptDeclarationDefinitionContract } from "src/module-resolution/protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _declaration names_, _declaration kind_. **/
export class TypeScriptDeclarationDefinition implements TypeScriptDeclarationDefinitionContract {
	private readonly _statement: ts.Statement;

	/** Responsibilities: _callable declaration names_. **/
	private callable_names(): readonly string[] {
		if (ts.isClassDeclaration(this._statement) || ts.isFunctionDeclaration(this._statement)) {
			if (this._statement.name === undefined) {
				return [];
			}
			return [this._statement.name.text];
		}
		return [];
	}

	/** Responsibilities: _contract declaration names_. **/
	private contract_name(): string {
		if (ts.isInterfaceDeclaration(this._statement)) {
			return this._statement.name.text;
		}
		if (ts.isTypeAliasDeclaration(this._statement)) {
			return this._statement.name.text;
		}
		if (ts.isEnumDeclaration(this._statement)) {
			return this._statement.name.text;
		}
		return "";
	}

	/** Responsibilities: _variable declaration names_. **/
	private variable_names(): readonly string[] {
		if (!ts.isVariableStatement(this._statement)) {
			return [];
		}
		const names: string[] = [];
		for (const declaration of this._statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name)) {
				names.push(declaration.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _declaration kind matching_. **/
	private named_kind(
		declared_name: string,
		expected_name: string,
		kind: ResolvedTypeScriptDeclarationKind,
	): ResolvedTypeScriptDeclarationKind {
		if (declared_name !== expected_name) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		return kind;
	}

	/** Responsibilities: _contract symbol kind_. **/
	private contract_kind(contract_name: string): ResolvedTypeScriptDeclarationKind {
		const declared_contract_name = this.contract_name();
		if (declared_contract_name === "") {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		return this.named_kind(declared_contract_name, contract_name, ResolvedTypeScriptDeclarationKind.Contract);
	}

	/** Responsibilities: _callable declaration kind_. **/
	private callable_declaration_kind(callable_name: string): ResolvedTypeScriptDeclarationKind {
		if (ts.isClassDeclaration(this._statement)) {
			if (this._statement.name === undefined) {
				return ResolvedTypeScriptDeclarationKind.Other;
			}
			return this.named_kind(this._statement.name.text, callable_name, ResolvedTypeScriptDeclarationKind.Class);
		}
		if (!ts.isFunctionDeclaration(this._statement) || this._statement.name === undefined) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		return this.named_kind(this._statement.name.text, callable_name, ResolvedTypeScriptDeclarationKind.Function);
	}

	/** Responsibilities: _callable variable symbol kind_. **/
	private variable_kind(variable_name: string): ResolvedTypeScriptDeclarationKind {
		if (!ts.isVariableStatement(this._statement)) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		for (const declaration of this._statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variable_name) {
				continue;
			}
			const initializer = declaration.initializer;
			if (initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
				return ResolvedTypeScriptDeclarationKind.Function;
			}
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _declaration identity_. **/
	public constructor(statement: ts.Statement) {
		this._statement = statement;
	}

	/** Responsibilities: _declared symbol names_. **/
	public names(): readonly string[] {
		const callables = this.callable_names();
		if (callables.length > 0) {
			return callables;
		}
		const contract_name = this.contract_name();
		if (contract_name !== "") {
			return [contract_name];
		}
		return this.variable_names();
	}

	/** Responsibilities: _symbol kind classification_. **/
	public kind(symbol_name: string): ResolvedTypeScriptDeclarationKind {
		const contract_kind = this.contract_kind(symbol_name);
		if (contract_kind !== ResolvedTypeScriptDeclarationKind.Other) {
			return contract_kind;
		}
		const callable_kind = this.callable_declaration_kind(symbol_name);
		if (callable_kind !== ResolvedTypeScriptDeclarationKind.Other) {
			return callable_kind;
		}
		return this.variable_kind(symbol_name);
	}
}
