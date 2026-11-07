import type {
	TypeScriptImplementedTypeIndexContract,
	TypeScriptMemberSet,
	TypeScriptMutableClasss,
} from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _interface member indexing_, _class contract indexing_. **/
export class TypeScriptImplementedTypeIndex implements TypeScriptImplementedTypeIndexContract {
	private readonly _members_by_contract: Map<string, TypeScriptMemberSet>;
	private readonly _class_contracts: TypeScriptMutableClasss;

	/** Responsibilities: _interface method indexing_. **/
	private append_interfaces(contract_source: ts.SourceFile): void {
		for (const statement of contract_source.statements) {
			if (!ts.isInterfaceDeclaration(statement)) {
				continue;
			}
			const members = new Set(
				statement.members.filter(ts.isMethodSignature).map((member) => member.name.getText(contract_source)),
			);
			this._members_by_contract.set(statement.name.text, members);
		}
	}

	/** Responsibilities: _class declaration indexing_. **/
	private append_classes(class_source: ts.SourceFile): void {
		for (const statement of class_source.statements) {
			if (!ts.isClassDeclaration(statement) || statement.name === undefined) {
				continue;
			}
			this.index_class(statement, statement.name.text);
		}
	}

	/** Responsibilities: _class heritage indexing_. **/
	private index_class(class_declaration: ts.ClassDeclaration, implementation_name: string): void {
		const clauses = class_declaration.heritageClauses;
		if (clauses === undefined) {
			return;
		}
		for (const clause of clauses) {
			if (clause.token !== ts.SyntaxKind.ImplementsKeyword) {
				continue;
			}
			this.append_heritage_contracts(implementation_name, clause.types);
		}
	}

	/** Responsibilities: _implemented interface association_. **/
	private append_heritage_contracts(
		implementing_class: string,
		heritage_types: readonly ts.ExpressionWithTypeArguments[],
	): void {
		for (const heritage of heritage_types) {
			if (!ts.isIdentifier(heritage.expression)) {
				continue;
			}
			const name = heritage.expression.text;
			const members = this._members_by_contract.get(name);
			if (members === undefined) {
				continue;
			}
			let contracts = this._class_contracts.get(implementing_class);
			if (contracts === undefined) {
				contracts = new Map();
				this._class_contracts.set(implementing_class, contracts);
			}
			contracts.set(name, new Set(members));
		}
	}

	/** Responsibilities: _contract index state initialization_. **/
	public constructor() {
		this._members_by_contract = new Map();
		this._class_contracts = new Map();
	}

	/** Responsibilities: _contract membership preparation_. **/
	public prepare(contract_source: ts.SourceFile): void {
		this._members_by_contract.clear();
		this._class_contracts.clear();
		this.append_interfaces(contract_source);
		this.append_classes(contract_source);
	}

	/** Responsibilities: _implemented contract member lookup_. **/
	public implemented_members(class_identity: string, contract_name: string): ReadonlySet<string> {
		const contracts = this._class_contracts.get(class_identity);
		if (contracts === undefined) {
			return new Set();
		}
		const members = contracts.get(contract_name);
		if (members !== undefined) {
			return members;
		}
		return new Set();
	}
}
