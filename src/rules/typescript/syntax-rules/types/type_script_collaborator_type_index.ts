import type { TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type {
	TypeScriptCollaboratorTypeIndexContract,
	TypeScriptImportedImplementationIndex,
	TypeScriptNameMap,
} from "src/rules/typescript/syntax-rules/types/types";
import type { RuleContextContract } from "src/types";
import ts from "typescript";

/** Responsibilities: _imported class resolution_, _contract membership indexing_. **/
export class TypeScriptCollaboratorTypeIndex implements TypeScriptCollaboratorTypeIndexContract {
	private readonly _implementations: TypeScriptImportedImplementationIndex;
	private readonly _source_file: ts.SourceFile;
	private readonly _context: RuleContextContract;

	/** Responsibilities: _local class declaration lookup_. **/
	private declaration(class_source: ts.SourceFile, class_name: string): ts.Node {
		for (const statement of class_source.statements) {
			if (ts.isClassDeclaration(statement) && statement.name?.text === class_name) {
				return statement;
			}
		}
		return class_source;
	}

	/** Responsibilities: _imported contract identity resolution_. **/
	private imported_symbol(contract_alias: string): TypeScriptModuleSymbolReference {
		for (const declaration of this._source_file.statements) {
			if (!ts.isImportDeclaration(declaration) || !ts.isStringLiteral(declaration.moduleSpecifier)) {
				continue;
			}
			const bindings = declaration.importClause?.namedBindings;
			if (bindings === undefined || !ts.isNamedImports(bindings)) {
				continue;
			}
			const imported = this.named_import(bindings, declaration, contract_alias);
			if (imported.file.length > 0) {
				return imported;
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _named import identity resolution_. **/
	private named_import(
		bindings: ts.NamedImports,
		declaration: ts.ImportDeclaration,
		requested_binding: string,
	): TypeScriptModuleSymbolReference {
		if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
			return { file: "", name: "" };
		}
		for (const element of bindings.elements) {
			if (element.name.text !== requested_binding) {
				continue;
			}
			const imported_name = this.imported_name(element);
			const module_file = this._context
				.state()
				.analysis.module_resolver.module_symbol(this._source_file.fileName, declaration.moduleSpecifier.text);
			return this._context.state().analysis.module_resolver.resolve({ file: module_file, name: imported_name });
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _interface method membership_. **/
	private contract_members(contract_source: ts.SourceFile, contract_name: string): Set<string> {
		const declaration = contract_source.statements.find(
			(item) => ts.isInterfaceDeclaration(item) && item.name.text === contract_name,
		);
		if (declaration === undefined || !ts.isInterfaceDeclaration(declaration)) {
			return new Set();
		}
		return new Set(
			declaration.members.filter(ts.isMethodSignature).map((member) => member.name.getText(contract_source)),
		);
	}

	/** Responsibilities: _interface member association_. **/
	private append_contract_members(
		contract: TypeScriptModuleSymbolReference,
		contract_source: ts.SourceFile,
		implemented: ReadonlySet<string>,
		contracts: TypeScriptNameMap,
	): void {
		const members = this.contract_members(contract_source, contract.name);
		if (members.size === 0) {
			return;
		}
		const member_list = [...members];
		const implemented_all = member_list.every((member) => implemented.has(member));
		if (implemented_all) {
			contracts.set(`${contract.file}\u0000${contract.name}`, members);
		}
	}

	/** Responsibilities: _single imported interface association_. **/
	private append_contract(
		heritage: ts.ExpressionWithTypeArguments,
		implemented: ReadonlySet<string>,
		contracts: TypeScriptNameMap,
	): void {
		if (!ts.isIdentifier(heritage.expression)) {
			return;
		}
		const contract = this.imported_symbol(heritage.expression.text);
		if (contract.file.length === 0) {
			return;
		}
		const contract_source = this._context.state().analysis.source_resolver.get(contract.file);
		if (contract_source === undefined) {
			return;
		}
		this.append_contract_members(contract, contract_source, implemented, contracts);
	}

	/** Responsibilities: _class interface associations_. **/
	private append_class_contracts(
		implementation: ts.ClassDeclaration,
		implementation_file: ts.SourceFile,
	): TypeScriptNameMap {
		const contracts: TypeScriptNameMap = new Map();
		const clauses = implementation.heritageClauses;
		if (clauses === undefined) {
			return contracts;
		}
		const implemented = new Set(
			implementation.members.filter(ts.isMethodDeclaration).map((member) => member.name.getText(implementation_file)),
		);
		for (const clause of clauses) {
			if (clause.token !== ts.SyntaxKind.ImplementsKeyword) {
				continue;
			}
			for (const heritage of clause.types) {
				this.append_contract(heritage, implemented, contracts);
			}
		}
		return contracts;
	}

	/** Responsibilities: _imported implementation association_. **/
	private append_import(declaration: ts.ImportDeclaration, element: ts.ImportSpecifier): void {
		if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
			return;
		}
		const imported_name = this.imported_name(element);
		const module_file = this._context
			.state()
			.analysis.module_resolver.module_symbol(this._source_file.fileName, declaration.moduleSpecifier.text);
		const resolved = this._context.state().analysis.module_resolver.resolve({ file: module_file, name: imported_name });
		this.append_resolved_class(element.name.text, resolved);
	}

	/** Responsibilities: _imported name resolution_. **/
	private imported_name(element: ts.ImportSpecifier): string {
		if (element.propertyName !== undefined) {
			return element.propertyName.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _class contract registration_. **/
	private append_resolved_class(local_class_alias: string, resolved: TypeScriptModuleSymbolReference): void {
		const imported_file = this._context.state().analysis.source_resolver.get(resolved.file);
		if (imported_file === undefined) {
			return;
		}
		const class_declaration = this.declaration(imported_file, resolved.name);
		if (!ts.isClassDeclaration(class_declaration)) {
			return;
		}
		const contracts = this.append_class_contracts(class_declaration, imported_file);
		if (contracts.size > 0) {
			this._implementations.set(local_class_alias, contracts);
		}
	}

	/** Responsibilities: _named implementation imports_. **/
	private append_named_imports(import_declaration: ts.ImportDeclaration): void {
		const clause = import_declaration.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return;
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return;
		}
		for (const element of clause.namedBindings.elements) {
			this.append_import(import_declaration, element);
		}
	}

	/** Responsibilities: _collaborator contract index initialization_. **/
	public constructor(source_file: ts.SourceFile, context: RuleContextContract) {
		this._implementations = new Map();
		this._source_file = source_file;
		this._context = context;
	}

	/** Responsibilities: _imported contract index preparation_. **/
	public prepare(): void {
		this._implementations.clear();
		for (const statement of this._source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_named_imports(statement);
			}
		}
	}

	/** Responsibilities: _class contract lookup_. **/
	public for_class(class_name: string): TypeScriptNameMap {
		const contracts = this._implementations.get(class_name);
		if (contracts !== undefined) {
			return contracts;
		}
		return new Map();
	}
}
