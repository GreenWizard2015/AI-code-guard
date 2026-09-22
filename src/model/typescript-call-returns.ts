import { TypeScriptCallReturnAnalysis } from 'src/bridge/ts/parser/typescript-call-return-analysis';
import { TypeScriptImportedCallOwners } from 'src/model/typescript-imported-call-owners';

import ts from 'typescript';
import type { TypeScriptSourceResolver } from 'src/model/types';

/** Responsibilities: _indexing TypeScript functions variables_. **/
export class TypeScriptCallReturns {
	private readonly source_file: ts.SourceFile;
	private readonly aliases: ReadonlyMap<string, string>;
	private readonly owners = new Map<string, string>();
	private readonly imported_call_owners: TypeScriptImportedCallOwners;

	/** Responsibilities: _index top-level function declarations_. **/
	private add_local_functions(): void {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();

		for (const statement of this.source_file.statements) {
			if (!ts.isFunctionDeclaration(statement) || !statement.name) {
				continue;
			}
			if (statement.type === undefined) {
				continue;
			}
			const owner = call_return_analysis.reference_owner(statement.type);
			if (owner) {
				this.owners.set(statement.name.text, owner);
			}
		}
	}

	/** Responsibilities: _indexing function-valued constructor-valued variables_. **/
	private add_local_variables(): void {
		for (const statement of this.source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				const owner = this.local_variable_owner(declaration);
				if (owner && ts.isIdentifier(declaration.name)) {
					this.owners.set(declaration.name.text, owner);
				}
			}
		}
	}

	/** Responsibilities: _resolution owner represented local_. **/
	private local_variable_owner(declaration: ts.VariableDeclaration): string {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();

		if (!ts.isIdentifier(declaration.name)) {
			return '';
		}
		if (declaration.initializer === undefined) {
			return '';
		}
		const initializers = call_return_analysis.unwrap_expression(declaration.initializer);
		if (initializers.length === 0) {
			return '';
		}
		const initializer = initializers[0];
		return this.function_initializer_owner(initializer);
	}

	/** Responsibilities: _resolution owner represented function_. **/
	private function_initializer_owner(initializer: ts.Expression): string {
if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) {
			return '';
		}
		const call_return_analysis = new TypeScriptCallReturnAnalysis();
		if (initializer.type === undefined) {
			return '';
		}
		return call_return_analysis.reference_owner(initializer.type);
	}

	/** Responsibilities: _indexing methods declared inside_. **/
	private add_local_methods(): void {
		for (const statement of this.source_file.statements) {
if (ts.isClassDeclaration(statement) || ts.isClassExpression(statement)) {
				const class_declaration = statement;
				this.add_class_methods(class_declaration);
			}
		}
	}

	/** Responsibilities: _indexing callable names owners_. **/
	private add_class_methods(class_declaration: ts.ClassLikeDeclaration): void {
		const class_name = class_declaration.name?.text;
		if (!class_name) {
			return;
		}
		for (const member of class_declaration.members) {
			const owner = this.class_method_owner(member);
			const method_name = this.class_method_name(member);
			if (owner && method_name) {
				this.owners.set([class_name, method_name].join('.'), owner);
			}
		}
	}

	/** Responsibilities: _resolution owner class class_. **/
	private class_method_owner(member: ts.ClassElement): string {
		if ((!ts.isMethodDeclaration(member)) || (!member.name) || member.type === undefined) {
			return '';
		}
		const analysis = new TypeScriptCallReturnAnalysis();
		return analysis.reference_owner(member.type);
	}

	/** Responsibilities: _resolution stable name class_. **/
	private class_method_name(member: ts.ClassElement): string {
		if (!ts.isMethodDeclaration(member) || !member.name) {
			return '';
		}
		return member.name.getText();
	}

	/** Responsibilities: _resolution callable owner through_. **/
	private owner_from_alias(key: string): string {
		const alias = this.aliases.get(key);
		if (alias === undefined) {
			return '';
		}
		const alias_owner = this.owners.get(alias);
		if (alias_owner !== undefined) {
			return alias_owner;
		}
		return '';
	}

	/** Responsibilities: _initialization source aliases callable_. **/
	constructor(
		source_file: ts.SourceFile,
		aliases: ReadonlyMap<string, string>,
		...resolvers: TypeScriptSourceResolver[]
	) {
		this.source_file = source_file;
		this.aliases = aliases;
		this.imported_call_owners = new TypeScriptImportedCallOwners(source_file, ...resolvers);
	}

	/** Responsibilities: _construction local callable owner_. **/
	public initialize(): void {
		this.add_local_functions();
		this.add_local_variables();
		this.add_local_methods();
		this.imported_call_owners.append_to(this.owners);
	}

	/** Responsibilities: _resolution owner callable name_. **/
	public owner_for(name: string, owner: string = ''): string {
		let key = name;
		if (owner) {
			key = [owner, name].join('.');
		}
		const direct_owner = this.owners.get(key);
		if (direct_owner !== undefined) {
			return direct_owner;
		}
		return this.owner_from_alias(key);
	}
}
