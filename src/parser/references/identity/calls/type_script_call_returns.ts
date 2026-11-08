import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";
import type { TypeScriptCallReturnsContract } from "src/model/protocols";
import { TypeScriptImportedCallOwners } from "src/parser/references/identity/calls/type_script_imported_call_owners";
import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptPropertySide } from "src/types";
import type { TypeScriptImportedCallOwnersContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _callable results_, _owner identity_. **/
export class TypeScriptCallReturns implements TypeScriptCallReturnsContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _aliases: ReadonlyMap<string, string>;
	private readonly _owners: Map<string, string>;
	private readonly _imported_call_owners: TypeScriptImportedCallOwnersContract;
	private readonly _call_return_analysis: TypeScriptCallReturnAnalysis;

	/** Responsibilities: _index top-level function declarations_. **/
	private add_local_functions(): void {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();
		for (const statement of this._source_file.statements) {
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
				this._owners.set(statement.name.text, owner);
			}
		}
	}

	/** Responsibilities: _indexing function-valued constructor-valued variables_. **/
	private add_local_variables(): void {
		for (const statement of this._source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				const owner = this.local_variable_owner(declaration);
				if (owner && ts.isIdentifier(declaration.name)) {
					this._owners.set(declaration.name.text, owner);
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
		const initializer = initializers.at(0);
		if (initializer === undefined) {
			return "";
		}
		return this.function_initializer_owner(initializer);
	}

	/** Responsibilities: _resolution owner represented function_. **/
	private function_initializer_owner(initializer: ts.Expression): string {
		if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) {
			return "";
		}
		if (initializer.type === undefined) {
			return "";
		}
		return this._call_return_analysis.reference_owner(initializer.type);
	}

	/** Responsibilities: _class method receiver side_. **/
	private class_method_side(side_member: ts.ClassElement): TypeScriptPropertySide {
		if (!ts.canHaveModifiers(side_member)) {
			return INSTANCE_PROPERTY_SIDE;
		}
		const modifiers = ts.getModifiers(side_member);
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
		for (const statement of this._source_file.statements) {
			if (ts.isClassDeclaration(statement) || ts.isClassExpression(statement)) {
				this.add_class_methods(statement);
			}
		}
	}

	/** Responsibilities: _indexing callable names owners_. **/
	private add_class_methods(class_declaration: ts.ClassLikeDeclaration): void {
		const name = class_declaration.name;
		if (name === undefined) {
			return;
		}
		const class_name = name.text;
		for (const member of class_declaration.members) {
			const owner = this.class_method_owner(member);
			const method_name = this.class_method_name(member);
			if (owner && method_name) {
				const side = this.class_method_side(member);
				this._owners.set([class_name, side, method_name].join("."), owner);
			}
		}
	}

	/** Responsibilities: _resolution owner class class_. **/
	private class_method_owner(owner_member: ts.ClassElement): string {
		if (!ts.isMethodDeclaration(owner_member)) {
			return "";
		}
		if (!owner_member.name) {
			return "";
		}
		if (owner_member.type === undefined) {
			return "";
		}
		return this._call_return_analysis.reference_owner(owner_member.type);
	}

	/** Responsibilities: _resolution stable name class_. **/
	private class_method_name(name_member: ts.ClassElement): string {
		if (!ts.isMethodDeclaration(name_member) || !name_member.name) {
			return "";
		}
		return name_member.name.getText();
	}

	/** Responsibilities: _resolution callable owner through_. **/
	private owner_from_alias(key: string): string {
		const alias = this._aliases.get(key);
		if (alias === undefined) {
			return "";
		}
		const owner = this._owners.get(alias);
		if (owner === undefined) {
			return "";
		}
		return owner;
	}

	/** Responsibilities: _initialization source aliases callable_. **/
	public constructor(
		source_file: ts.SourceFile,
		aliases: ReadonlyMap<string, string>,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this._owners = new Map<string, string>();
		this._call_return_analysis = new TypeScriptCallReturnAnalysis();
		this._source_file = source_file;
		this._aliases = aliases;
		this._imported_call_owners = new TypeScriptImportedCallOwners(source_file, project_root, source_files, source_io);
	}

	/** Responsibilities: _local callable owner index_. **/
	public initialize(): void {
		this.add_local_functions();
		this.add_local_variables();
		this.add_local_methods();
		this._imported_call_owners.append_to(this._owners);
	}

	/** Responsibilities: _resolution owner callable name_. **/
	public owner_for(name: string, owner: string, side: TypeScriptPropertySide): string {
		if (this._owners.size === 0) {
			this.initialize();
		}
		let key = name;
		if (owner) {
			key = [owner, side, name].join(".");
		}
		const direct_owner = this._owners.get(key);
		if (direct_owner !== undefined) {
			return direct_owner;
		}
		return this.owner_from_alias(key);
	}
}
