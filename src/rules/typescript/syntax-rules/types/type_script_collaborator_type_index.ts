import type { TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import { TypeScriptCollaboratorImports } from "src/rules/typescript/syntax-rules/types/type_script_collaborator_imports";
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
	private readonly _context: RuleContextContract;
	private readonly _imports: TypeScriptCollaboratorImports;

	/** Responsibilities: _local class declaration lookup_. **/
	private declaration(class_source: ts.SourceFile, class_name: string): ts.Node {
		for (const statement of class_source.statements) {
			if (ts.isClassDeclaration(statement)) {
				const name = statement.name;
				if (name !== undefined && name.text === class_name) {
					return statement;
				}
			}
		}
		return class_source;
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
		const contract = this._imports.symbol(heritage.expression.text);
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

	/** Responsibilities: _collaborator contract index initialization_. **/
	public constructor(source_file: ts.SourceFile, context: RuleContextContract) {
		this._implementations = new Map();
		this._context = context;
		this._imports = new TypeScriptCollaboratorImports(source_file, context);
	}

	/** Responsibilities: _imported contract index preparation_. **/
	public prepare(): void {
		this._implementations.clear();
		this._imports.prepare();
		for (const [local_name, symbol] of this._imports.named_symbols()) {
			this.append_resolved_class(local_name, symbol);
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
