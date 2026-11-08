import { TypeScriptReferenceType } from "src/parser/analysis/type_script_reference_type";
import ts from "typescript";

/** Responsibilities: _declaration member lookup_, _property type resolution_. **/
export class TypeScriptPropertyTypeLookup {
	private readonly _source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly _declaration_name: string;
	private readonly _property_name: string;

	/** Responsibilities: _named declaration classification_. **/
	private is_owner_declaration(declaration: ts.Statement): boolean {
		if (ts.isClassLike(declaration)) {
			const name = declaration.name;
			return name !== undefined && name.text === this._declaration_name;
		}
		if (ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)) {
			return declaration.name.text === this._declaration_name;
		}
		return false;
	}

	/** Responsibilities: _declaration member extraction_. **/
	private declaration_members(declaration: ts.Statement): readonly ts.Node[] {
		if (ts.isClassLike(declaration) || ts.isInterfaceDeclaration(declaration)) {
			return declaration.members;
		}
		if (ts.isTypeAliasDeclaration(declaration) && ts.isTypeLiteralNode(declaration.type)) {
			return declaration.type.members;
		}
		return [];
	}

	/** Responsibilities: _property type lookup initialization_. **/
	public constructor(
		source_files: ReadonlyMap<string, ts.SourceFile>,
		declaration_name: string,
		property_name: string,
	) {
		this._source_files = source_files;
		this._declaration_name = declaration_name;
		this._property_name = property_name;
	}

	/** Responsibilities: _member type lookup_. **/
	public member_type_name(member: ts.Node): string {
		if (!ts.isPropertySignature(member) && !ts.isPropertyDeclaration(member)) {
			return "";
		}
		if (member.name === undefined || !ts.isIdentifier(member.name)) {
			return "";
		}
		if (member.name.text !== this._property_name || member.type === undefined) {
			return "";
		}
		const reference_type = new TypeScriptReferenceType(member.type);
		return reference_type.return_owner();
	}

	/** Responsibilities: _property type resolution_. **/
	public type_name(owner_file: string): string {
		const source = this._source_files.get(owner_file);
		if (source === undefined) {
			return "";
		}
		for (const declaration of source.statements) {
			if (!this.is_owner_declaration(declaration)) {
				continue;
			}
			for (const member of this.declaration_members(declaration)) {
				const type_name = this.member_type_name(member);
				if (type_name) {
					return type_name;
				}
			}
		}
		return "";
	}
}
