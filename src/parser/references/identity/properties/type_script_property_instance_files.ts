import ts from "typescript";
import type { TypeScriptPropertyInstanceFilesContract } from "src/model/protocols";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import type { TypeScriptPropertySide } from "src/types";
import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";

/** Responsibilities: _property source file collection_, _unique owner file resolution_. **/
export class TypeScriptPropertyInstanceFiles implements TypeScriptPropertyInstanceFilesContract {
	private readonly imported_binding_files: ReadonlyMap<string, string>;
	private readonly files: Map<string, string>;
	private readonly declaration_predicates: DeclarationPredicates;

	/** Responsibilities: _imported binding file resolution_. **/
	private binding_file(name: string): string {
		const file = this.imported_binding_files.get(name);
		if (file === undefined) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _property file storage_. **/
	private append_file(
		owner_file: string,
		owner_class: string,
		name: string,
		binding: string,
		side: TypeScriptPropertySide,
	): void {
		const file = this.binding_file(binding);
		if (file.length > 0) {
			this.files.set(`${side}.${owner_file}.${owner_class}.${name}`, file);
		}
	}

	/** Responsibilities: _typed property file collection_. **/
	private append_type(
		node: ts.Node,
		owner_file: string,
		owner_class: string,
		name: string,
		side: TypeScriptPropertySide,
	): void {
		if (ts.isPropertyDeclaration(node)) {
			if (node.type !== undefined) {
				this.append_reference_type(node.type, owner_file, owner_class, name, side);
			}
			return;
		}
		if (ts.isPropertySignature(node)) {
			if (node.type !== undefined) {
				this.append_reference_type(node.type, owner_file, owner_class, name, side);
			}
			return;
		}
		if (ts.isParameter(node)) {
			if (node.type !== undefined) {
				this.append_reference_type(node.type, owner_file, owner_class, name, side);
			}
		}
	}

	/** Responsibilities: _type reference file collection_. **/
	private append_reference_type(
		type: ts.TypeNode,
		owner_file: string,
		owner_class: string,
		name: string,
		side: TypeScriptPropertySide,
	): void {
		if (!ts.isTypeReferenceNode(type)) {
			return;
		}
		if (!ts.isIdentifier(type.typeName)) {
			return;
		}
		this.append_file(owner_file, owner_class, name, type.typeName.text, side);
	}

	/** Responsibilities: _property initialization_. **/
	private append_initializer(
		node: ts.Node,
		owner_file: string,
		owner_class: string,
		name: string,
		side: TypeScriptPropertySide,
	): void {
		if (!ts.isPropertyDeclaration(node) && !ts.isParameter(node)) {
			return;
		}
		const initializer = node.initializer;
		if (initializer === undefined) {
			return;
		}
		if (!ts.isNewExpression(initializer)) {
			return;
		}
		if (!ts.isIdentifier(initializer.expression)) {
			return;
		}
		this.append_file(owner_file, owner_class, name, initializer.expression.text, side);
	}

	/** Responsibilities: _matching property file count_. **/
	private matching_count(owner_file: string, name: string, side: TypeScriptPropertySide): number {
		const suffix = `.${name}`;
		let count = 0;
		for (const key of this.files.keys()) {
			if (key.startsWith(`${side}.${owner_file}.`) === false) {
				continue;
			}
			if (key.endsWith(suffix)) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _first matching property file_. **/
	private first_matching_file(owner_file: string, name: string, side: TypeScriptPropertySide): string {
		const suffix = `.${name}`;
		for (const [key, file] of this.files) {
			if (key.startsWith(`${side}.${owner_file}.`) === false) {
				continue;
			}
			if (key.endsWith(suffix)) {
				return file;
			}
		}
		return "";
	}

	/** Responsibilities: _unique property file lookup_. **/
	private unique_file(owner_file: string, name: string, side: TypeScriptPropertySide): string {
		if (this.matching_count(owner_file, name, side) !== 1) {
			return "";
		}
		return this.first_matching_file(owner_file, name, side);
	}

	/** Responsibilities: _property instance name_. **/
	private instance_name(node: ts.Node): string {
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (ts.isIdentifier(node.name)) {
				return node.name.text;
			}
			return "";
		}
		if (!ts.isParameter(node)) {
			return "";
		}
		if (!this.declaration_predicates.parameter_property(node)) {
			return "";
		}
		if (!ts.isIdentifier(node.name)) {
			return "";
		}
		return node.name.text;
	}

	/** Responsibilities: _static property classification_. **/
	private property_side(node: ts.Node): TypeScriptPropertySide {
		if (!ts.isPropertyDeclaration(node)) {
			return INSTANCE_PROPERTY_SIDE;
		}
		if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
			return STATIC_PROPERTY_SIDE;
		}
		return INSTANCE_PROPERTY_SIDE;
	}

	/** Responsibilities: _property instance state initialization_. **/
	public constructor(imported_binding_files: ReadonlyMap<string, string>) {
		this.imported_binding_files = imported_binding_files;
		this.files = new Map<string, string>();
		this.declaration_predicates = new DeclarationPredicates();
	}

	/** Responsibilities: _property instance collection_. **/
	public collect(node: ts.Node, owner_file: string, owner_class: string): void {
		if (owner_file.length === 0) {
			return;
		}
		const name = this.instance_name(node);
		if (name.length === 0) {
			return;
		}
		const side = this.property_side(node);
		this.append_type(node, owner_file, owner_class, name, side);
		this.append_initializer(node, owner_file, owner_class, name, side);
	}

	/** Responsibilities: _property file lookup_. **/
	public file(owner_file: string, owner_class: string, name: string, side: TypeScriptPropertySide): string {
		const direct_file = this.files.get(`${side}.${owner_file}.${owner_class}.${name}`);
		if (direct_file !== undefined) {
			return direct_file;
		}
		return this.unique_file(owner_file, name, side);
	}
}
