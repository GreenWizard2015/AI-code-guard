import type { TypeScriptPropertyInstanceFilesContract } from "src/model/protocols";
import { ConstructorRules } from "src/parser/analysis/constructor_rules";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import type { TypeScriptPropertyInstanceFileEntryOptions } from "src/parser/references/identity/properties/protocols";
import { TypeScriptPropertyInstanceFileEntry } from "src/parser/references/identity/properties/type_script_property_instance_file_entry";
import type { TypeScriptPropertySide } from "src/types";
import type ts from "typescript";

/** Responsibilities: _property source file collection_, _unique owner file resolution_. **/
export class TypeScriptPropertyInstanceFiles implements TypeScriptPropertyInstanceFilesContract {
	private readonly _imported_binding_files: ReadonlyMap<string, string>;
	private readonly _files: Map<string, string>;
	private readonly _declaration_predicates: DeclarationPredicates;

	/** Responsibilities: _unique property file lookup_. **/
	private unique_file(search_owner_file: string, name: string, side: TypeScriptPropertySide): string {
		let matched_file = "";
		for (const [key, file] of this._files) {
			if (!key.startsWith(`${side}.${search_owner_file}.`) || !key.endsWith(`.${name}`)) {
				continue;
			}
			if (matched_file.length > 0) {
				return "";
			}
			matched_file = file;
		}
		return matched_file;
	}

	/** Responsibilities: _property instance state initialization_. **/
	public constructor(imported_binding_files: ReadonlyMap<string, string>) {
		this._imported_binding_files = imported_binding_files;
		this._files = new Map<string, string>();
		this._declaration_predicates = new DeclarationPredicates(new ConstructorRules());
	}

	/** Responsibilities: _property instance collection_. **/
	public collect(declaration_node: ts.Node, collection_file: string, owner_class: string): void {
		const options: TypeScriptPropertyInstanceFileEntryOptions = {
			node: declaration_node,
			owner_file: collection_file,
			owner_class,
			imported_binding_files: this._imported_binding_files,
			files: this._files,
			declaration_predicates: this._declaration_predicates,
		};
		const entry = new TypeScriptPropertyInstanceFileEntry(options);
		entry.append_type();
		entry.append_initializer();
	}

	/** Responsibilities: _property file lookup_. **/
	public file(query_owner_file: string, owner_class: string, name: string, side: TypeScriptPropertySide): string {
		const key = `${side}.${query_owner_file}.${owner_class}.${name}`;
		const direct_file = this._files.get(key);
		if (direct_file !== undefined) {
			return direct_file;
		}
		return this.unique_file(query_owner_file, name, side);
	}
}
