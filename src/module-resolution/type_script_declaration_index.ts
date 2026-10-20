import ts from "typescript";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { TypeScriptModuleCache } from "src/module-resolution/types";
import type { TypeScriptDeclarationIndexContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _symbol declaration indexing_, _declaration kind resolution_. **/
export class TypeScriptDeclarationIndex implements TypeScriptDeclarationIndexContract {
	private readonly cache: TypeScriptModuleCache;

	/** Responsibilities: _declaration statement names_. **/
	private statement_names(statement: ts.Statement): readonly string[] {
		if (ts.isClassDeclaration(statement)) {
			return this.class_names(statement);
		}
		if (ts.isFunctionDeclaration(statement)) {
			return this.function_names(statement);
		}
		const contract_name = this.contract_name(statement);
		if (contract_name.length > 0) {
			return [contract_name];
		}
		return this.variable_names(statement);
	}

	/** Responsibilities: _variable declaration names_. **/
	private variable_names(statement: ts.Statement): readonly string[] {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		const names: string[] = [];
		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name)) {
				names.push(declaration.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _class declaration name extraction_. **/
	private class_names(statement: ts.ClassDeclaration): readonly string[] {
		if (statement.name === undefined) {
			return [];
		}
		return [statement.name.text];
	}

	/** Responsibilities: _function declaration name extraction_. **/
	private function_names(statement: ts.FunctionDeclaration): readonly string[] {
		if (statement.name === undefined) {
			return [];
		}
		return [statement.name.text];
	}

	/** Responsibilities: _contract declaration naming_. **/
	private contract_name(statement: ts.Statement): string {
		if (ts.isInterfaceDeclaration(statement)) {
			return statement.name.text;
		}
		if (ts.isTypeAliasDeclaration(statement)) {
			return statement.name.text;
		}
		if (ts.isEnumDeclaration(statement)) {
			return statement.name.text;
		}
		return "";
	}

	/** Responsibilities: _source declaration index_. **/
	private declaration_index(source_file: ts.SourceFile): ReadonlyMap<string, readonly ts.Statement[]> {
		const cached = this.cache.declaration_indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, ts.Statement[]>();
		for (const statement of source_file.statements) {
			this.append_statement_names(index, statement);
		}
		this.cache.declaration_indexes.set(source_file, index);
		return index;
	}

	/** Responsibilities: _declaration names index addition_. **/
	private append_statement_names(index: Map<string, ts.Statement[]>, statement: ts.Statement): void {
		for (const name of this.statement_names(statement)) {
			const declarations = index.get(name);
			if (declarations === undefined) {
				index.set(name, [statement]);
				continue;
			}
			declarations.push(statement);
		}
	}

	/** Responsibilities: _single declaration kind resolution_. **/
	private declaration_kind(statement: ts.Statement, name: string): ResolvedTypeScriptDeclarationKind {
		if (ts.isClassDeclaration(statement)) {
			return this.class_kind(statement, name);
		}
		const contract_name = this.contract_name(statement);
		if (contract_name.length > 0) {
			return this.contract_kind(contract_name, name);
		}
		if (ts.isFunctionDeclaration(statement)) {
			return this.function_kind(statement, name);
		}
		if (ts.isVariableStatement(statement)) {
			return this.variable_declaration_kind(statement, name);
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _class declaration kind_. **/
	private class_kind(statement: ts.ClassDeclaration, name: string): ResolvedTypeScriptDeclarationKind {
		if (statement.name === undefined) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		if (statement.name.text === name) {
			return ResolvedTypeScriptDeclarationKind.Class;
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _contract declaration kind_. **/
	private contract_kind(contract_name: string, name: string): ResolvedTypeScriptDeclarationKind {
		if (contract_name === name) {
			return ResolvedTypeScriptDeclarationKind.Contract;
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _function declaration kind_. **/
	private function_kind(statement: ts.FunctionDeclaration, name: string): ResolvedTypeScriptDeclarationKind {
		if (statement.name === undefined) {
			return ResolvedTypeScriptDeclarationKind.Other;
		}
		if (statement.name.text === name) {
			return ResolvedTypeScriptDeclarationKind.Function;
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _callable variable declaration kind_. **/
	private variable_declaration_kind(statement: ts.VariableStatement, name: string): ResolvedTypeScriptDeclarationKind {
		for (const candidate of statement.declarationList.declarations) {
			if (!ts.isIdentifier(candidate.name)) {
				continue;
			}
			if (candidate.name.text !== name) {
				continue;
			}
			const initializer = candidate.initializer;
			if (initializer === undefined) {
				continue;
			}
			if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
				return ResolvedTypeScriptDeclarationKind.Function;
			}
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _symbol kind cache access_. **/
	private kind_cache(source_file: ts.SourceFile): Map<string, ResolvedTypeScriptDeclarationKind> {
		let kinds = this.cache.symbol_kinds.get(source_file);
		if (kinds === undefined) {
			kinds = new Map<string, ResolvedTypeScriptDeclarationKind>();
			this.cache.symbol_kinds.set(source_file, kinds);
		}
		return kinds;
	}

	/** Responsibilities: _source symbol kind resolution_. **/
	private resolve_symbol_kind(source_file: ts.SourceFile, name: string): ResolvedTypeScriptDeclarationKind {
		for (const statement of this.declarations_for(source_file, name)) {
			const kind = this.declaration_kind(statement, name);
			if (kind !== ResolvedTypeScriptDeclarationKind.Other) {
				return kind;
			}
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _declaration index initialization_. **/
	public constructor(cache: TypeScriptModuleCache) {
		this.cache = cache;
	}

	/** Responsibilities: _modifier presence_. **/
	public modifier_present(statement: ts.Statement, kind: ts.SyntaxKind): boolean {
		if (!ts.canHaveModifiers(statement)) {
			return false;
		}
		const modifiers = ts.getModifiers(statement);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === kind);
	}

	/** Responsibilities: _indexed declarations lookup_. **/
	public declarations_for(source_file: ts.SourceFile, name: string): readonly ts.Statement[] {
		const declarations = this.declaration_index(source_file).get(name);
		if (declarations === undefined) {
			return [];
		}
		return declarations;
	}

	/** Responsibilities: _default declarations lookup_. **/
	public default_declarations(source_file: ts.SourceFile): readonly ts.Statement[] {
		const cached = this.cache.default_declarations.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const declarations = source_file.statements.filter((statement) =>
			this.modifier_present(statement, ts.SyntaxKind.DefaultKeyword),
		);
		this.cache.default_declarations.set(source_file, declarations);
		return declarations;
	}

	/** Responsibilities: _export assignment lookup_. **/
	public export_assignments(source_file: ts.SourceFile): readonly ts.ExportAssignment[] {
		const cached = this.cache.export_assignments.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const assignments = source_file.statements.filter(ts.isExportAssignment);
		this.cache.export_assignments.set(source_file, assignments);
		return assignments;
	}

	/** Responsibilities: _declaration kind classification_. **/
	public symbol_kind(source_file: ts.SourceFile, name: string): ResolvedTypeScriptDeclarationKind {
		const kinds = this.kind_cache(source_file);
		const cached = kinds.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.resolve_symbol_kind(source_file, name);
		kinds.set(name, result);
		return result;
	}
}
