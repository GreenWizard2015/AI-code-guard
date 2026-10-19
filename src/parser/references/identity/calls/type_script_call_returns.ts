import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import type { TypeScriptCallReturnsContract } from "src/model/protocols";
import type { TypeScriptImportedCallOwnersContract } from "src/protocols";
import type { TypeScriptPropertySide } from "src/types";
import { TypeScriptImportedCallOwners } from "src/parser/references/identity/calls/type_script_imported_call_owners";
import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/parser/references/constants";
import ts from "typescript";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _callable results_, _owner identity_. **/
export class TypeScriptCallReturns implements TypeScriptCallReturnsContract {
	private readonly source_file: ts.SourceFile;
	private readonly aliases: ReadonlyMap<string, string>;
	private readonly owners: Map<string, string>;
	private readonly imported_call_owners: TypeScriptImportedCallOwnersContract;
	private readonly call_return_analysis: TypeScriptCallReturnAnalysis;

	/** Responsibilities: _index top-level function declarations_. **/
	private add_local_functions(): void {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();
		for (const statement of this.source_file.statements) {
			if (!ts.isFunctionDeclaration(statement)) {
				continue;
			}
			if (!statement.name) {
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
			return "";
		}
		if (declaration.initializer === undefined) {
			return "";
		}
		const initializers = call_return_analysis.unwrap_expression(declaration.initializer);
		if (initializers.length === 0) {
			return "";
		}
		return this.function_initializer_owner(initializers[0]);
	}

	/** Responsibilities: _resolution owner represented function_. **/
	private function_initializer_owner(initializer: ts.Expression): string {
		if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) {
			return "";
		}
		if (initializer.type === undefined) {
			return "";
		}
		return this.call_return_analysis.reference_owner(initializer.type);
	}

	/** Responsibilities: _class method receiver side_. **/
	private class_method_side(member: ts.ClassElement): TypeScriptPropertySide {
		if (!ts.canHaveModifiers(member)) {
			return INSTANCE_PROPERTY_SIDE;
		}
		const modifiers = ts.getModifiers(member);
		if (modifiers === undefined) {
			return INSTANCE_PROPERTY_SIDE;
		}
		if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
			return INSTANCE_PROPERTY_SIDE;
		}
		return STATIC_PROPERTY_SIDE;
	}

	/** Responsibilities: _indexing methods declared inside_. **/
	private add_local_methods(): void {
		for (const statement of this.source_file.statements) {
			if (ts.isClassDeclaration(statement) || ts.isClassExpression(statement)) {
				this.add_class_methods(statement);
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
				const side = this.class_method_side(member);
				this.owners.set([class_name, side, method_name].join("."), owner);
			}
		}
	}

	/** Responsibilities: _resolution owner class class_. **/
	private class_method_owner(member: ts.ClassElement): string {
		if (!ts.isMethodDeclaration(member)) {
			return "";
		}
		if (!member.name) {
			return "";
		}
		if (member.type === undefined) {
			return "";
		}
		return this.call_return_analysis.reference_owner(member.type);
	}

	/** Responsibilities: _resolution stable name class_. **/
	private class_method_name(member: ts.ClassElement): string {
		if (!ts.isMethodDeclaration(member) || !member.name) {
			return "";
		}
		return member.name.getText();
	}

	/** Responsibilities: _resolution callable owner through_. **/
	private owner_from_alias(key: string): string {
		const alias = this.aliases.get(key);
		if (alias === undefined) {
			return "";
		}
		const owner = this.owners.get(alias);
		if (owner === undefined) {
			return "";
		}
		return owner;
	}

	/** Responsibilities: _initialization source aliases callable_. **/
	constructor(
		source_file: ts.SourceFile,
		aliases: ReadonlyMap<string, string>,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this.owners = new Map<string, string>();
		this.call_return_analysis = new TypeScriptCallReturnAnalysis();
		this.source_file = source_file;
		this.aliases = aliases;
		this.imported_call_owners = new TypeScriptImportedCallOwners(source_file, project_root, source_files, source_io);
	}

	/** Responsibilities: _local callable owner index_. **/
	public initialize(): void {
		this.add_local_functions();
		this.add_local_variables();
		this.add_local_methods();
		this.imported_call_owners.append_to(this.owners);
	}

	/** Responsibilities: _resolution owner callable name_. **/
	public owner_for(name: string, owner: string, side: TypeScriptPropertySide): string {
		if (this.owners.size === 0) {
			this.initialize();
		}
		let key = name;
		if (owner) {
			key = [owner, side, name].join(".");
		}
		const direct_owner = this.owners.get(key);
		if (direct_owner !== undefined) {
			return direct_owner;
		}
		return this.owner_from_alias(key);
	}
}
