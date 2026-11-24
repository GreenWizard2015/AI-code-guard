import type {
	TypeScriptCreationAlias,
	TypeScriptCreationAliasIndex,
	TypeScriptNameMap,
} from "src/rules/typescript/syntax-rules/types/types";
import type { RuleContextContract } from "src/types";
import ts from "typescript";

/** Responsibilities: _contract-typed instance usage_, _creation identity retention_. **/
export class TypeScriptCollaboratorTypeUsage {
	private readonly _source_file: ts.SourceFile;
	private readonly _context: RuleContextContract;
	private readonly _owner: ts.MethodDeclaration;
	private readonly _contracts: TypeScriptNameMap;
	private readonly _aliases: TypeScriptCreationAliasIndex;

	/** Responsibilities: _nested callable boundary_. **/
	private nested_callable(scope_candidate: ts.Node): boolean {
		if (scope_candidate === this._owner) {
			return false;
		}
		return ts.isFunctionLike(scope_candidate);
	}

	/** Responsibilities: _typed collaborator construction identity_. **/
	private alias_contract(alias_candidate: ts.Node): string {
		if (!ts.isVariableDeclaration(alias_candidate) || !ts.isIdentifier(alias_candidate.name)) {
			return "";
		}
		if (alias_candidate.initializer === undefined || !ts.isNewExpression(alias_candidate.initializer)) {
			return "";
		}
		const annotation = alias_candidate.type;
		if (annotation === undefined) {
			return "";
		}
		if (!ts.isTypeReferenceNode(annotation) || !ts.isIdentifier(annotation.typeName)) {
			return "";
		}
		return this.imported_contract(annotation.typeName.text);
	}

	/** Responsibilities: _typed collaborator alias registration_. **/
	private append_alias(alias_candidate: ts.Node): void {
		const imported_contract = this.alias_contract(alias_candidate);
		if (imported_contract.length === 0) {
			return;
		}
		if (!ts.isVariableDeclaration(alias_candidate) || !ts.isIdentifier(alias_candidate.name)) {
			return;
		}
		if (alias_candidate.initializer === undefined || !ts.isNewExpression(alias_candidate.initializer)) {
			return;
		}
		const methods = this._contracts.get(imported_contract);
		if (methods === undefined) {
			return;
		}
		const alias: TypeScriptCreationAlias = { creation: alias_candidate.initializer, methods };
		this._aliases.set(alias_candidate.name.text, alias);
	}

	/** Responsibilities: _local assignment invalidation_. **/
	private append_reassignment(assignment_candidate: ts.Node, reassigned: Set<string>): void {
		if (!ts.isBinaryExpression(assignment_candidate) || !ts.isIdentifier(assignment_candidate.left)) {
			return;
		}
		if (assignment_candidate.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			reassigned.add(assignment_candidate.left.text);
		}
	}

	/** Responsibilities: _imported symbol identity_. **/
	private imported_element_name(element: ts.ImportSpecifier): string {
		if (element.propertyName === undefined) {
			return element.name.text;
		}
		return element.propertyName.text;
	}

	/** Responsibilities: _imported binding name resolution_. **/
	private imported_name(import_declaration: ts.ImportDeclaration, local_alias: string): string {
		if (!ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return "";
		}
		const clause = import_declaration.importClause;
		if (clause === undefined) {
			return "";
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return "";
		}
		for (const element of bindings.elements) {
			if (element.name.text === local_alias) {
				return this.imported_element_name(element);
			}
		}
		return "";
	}

	/** Responsibilities: _imported contract identity resolution_. **/
	private contract_import(import_declaration: ts.ImportDeclaration, local_contract_alias: string): string {
		const imported_name = this.imported_name(import_declaration, local_contract_alias);
		if (imported_name.length === 0 || !ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return "";
		}
		const module_file = this._context
			.state()
			.analysis.module_resolver.module_symbol(this._source_file.fileName, import_declaration.moduleSpecifier.text);
		const resolved = this._context.state().analysis.module_resolver.resolve({ file: module_file, name: imported_name });
		return `${resolved.file}\u0000${resolved.name}`;
	}

	/** Responsibilities: _imported contract key lookup_. **/
	private imported_contract(contract_alias: string): string {
		for (const statement of this._source_file.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			const contract = this.contract_import(statement, contract_alias);
			if (contract.length > 0) {
				return contract;
			}
		}
		return "";
	}

	/** Responsibilities: _callable alias index preparation_. **/
	private append_aliases(): void {
		const reassigned = new Set<string>();
		const collect = (node: ts.Node): void => {
			if (this.nested_callable(node)) {
				return;
			}
			this.append_reassignment(node, reassigned);
			this.append_alias(node);
			node.forEachChild(collect);
		};
		if (this._owner.body !== undefined) {
			collect(this._owner.body);
		}
		for (const name of reassigned) {
			this._aliases.delete(name);
		}
	}

	/** Responsibilities: _contract method invocation match_. **/
	private matches_call(call_candidate: ts.Node, expected_creation: ts.NewExpression): boolean {
		if (!ts.isCallExpression(call_candidate) || !ts.isPropertyAccessExpression(call_candidate.expression)) {
			return false;
		}
		const receiver = call_candidate.expression.expression;
		if (!ts.isIdentifier(receiver)) {
			return false;
		}
		const alias = this._aliases.get(receiver.text);
		if (alias === undefined || alias.creation !== expected_creation) {
			return false;
		}
		return alias.methods.has(call_candidate.expression.name.text);
	}

	/** Responsibilities: _contract method invocation matching_. **/
	public constructor(
		source_file: ts.SourceFile,
		context: RuleContextContract,
		owner: ts.MethodDeclaration,
		contracts: TypeScriptNameMap,
	) {
		this._source_file = source_file;
		this._context = context;
		this._owner = owner;
		this._contracts = contracts;
		this._aliases = new Map();
	}

	/** Responsibilities: _contract method invocation_. **/
	public uses(creation: ts.NewExpression): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found || this.nested_callable(node)) {
				return;
			}
			if (this.matches_call(node, creation)) {
				found = true;
				return;
			}
			node.forEachChild(visit);
		};
		if (this._owner.body !== undefined) {
			visit(this._owner.body);
		}
		return found;
	}

	/** Responsibilities: _typed alias index preparation_. **/
	public prepare(): void {
		this._aliases.clear();
		this.append_aliases();
	}
}
