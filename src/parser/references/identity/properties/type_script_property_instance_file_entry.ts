import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";
import type { DeclarationPredicatesContract } from "src/parser/analysis/protocols";
import type {
	TypeScriptPropertyInstanceFileEntryContract,
	TypeScriptPropertyInstanceFileEntryOptions,
} from "src/parser/references/identity/properties/protocols";
import type { TypeScriptPropertySide } from "src/types";
import ts from "typescript";

/** Responsibilities: _property import indexing_, _owner identity preservation_. **/
export class TypeScriptPropertyInstanceFileEntry implements TypeScriptPropertyInstanceFileEntryContract {
	private readonly _node: ts.Node;
	private readonly _owner_file: string;
	private readonly _owner_class: string;
	private readonly _imported_binding_files: ReadonlyMap<string, string>;
	private readonly _files: Map<string, string>;
	private readonly _declaration_predicates: DeclarationPredicatesContract;

	/** Responsibilities: _property declaration name lookup_. **/
	private instance_name(): string {
		if (ts.isPropertyDeclaration(this._node) || ts.isPropertySignature(this._node)) {
			if (ts.isIdentifier(this._node.name)) {
				return this._node.name.text;
			}
			return "";
		}
		if (!ts.isParameter(this._node) || !this._declaration_predicates.parameter_property(this._node)) {
			return "";
		}
		if (!ts.isIdentifier(this._node.name)) {
			return "";
		}
		return this._node.name.text;
	}

	/** Responsibilities: _property storage side classification_. **/
	private property_side(): TypeScriptPropertySide {
		if (!ts.isPropertyDeclaration(this._node)) {
			return INSTANCE_PROPERTY_SIDE;
		}
		const modifiers = this._node.modifiers;
		if (modifiers !== undefined && modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
			return STATIC_PROPERTY_SIDE;
		}
		return INSTANCE_PROPERTY_SIDE;
	}

	/** Responsibilities: _imported property file registration_. **/
	private append_file(binding: string): void {
		if (this._owner_file.length === 0 || this.instance_name().length === 0) {
			return;
		}
		const file = this._imported_binding_files.get(binding);
		if (file === undefined || file.length === 0) {
			return;
		}
		const key = `${this.property_side()}.${this._owner_file}.${this._owner_class}.${this.instance_name()}`;
		this._files.set(key, file);
	}

	/** Responsibilities: _type reference registration_. **/
	private append_reference_type(type: ts.TypeNode): void {
		if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
			this.append_file(type.typeName.text);
		}
	}

	/** Responsibilities: _property annotation extraction_. **/
	private append_type_reference(node: ts.Node): void {
		if (!ts.isPropertyDeclaration(node) && !ts.isPropertySignature(node)) {
			if (!ts.isParameter(node)) {
				return;
			}
		}
		if (node.type !== undefined) {
			this.append_reference_type(node.type);
		}
	}

	/** Responsibilities: _property import index initialization_. **/
	public constructor(options: TypeScriptPropertyInstanceFileEntryOptions) {
		this._node = options.node;
		this._owner_file = options.owner_file;
		this._owner_class = options.owner_class;
		this._imported_binding_files = options.imported_binding_files;
		this._files = options.files;
		this._declaration_predicates = options.declaration_predicates;
	}

	/** Responsibilities: _property type import collection_. **/
	public append_type(): void {
		this.append_type_reference(this._node);
	}

	/** Responsibilities: _property initializer import collection_. **/
	public append_initializer(): void {
		if (!ts.isPropertyDeclaration(this._node) && !ts.isParameter(this._node)) {
			return;
		}
		const initializer = this._node.initializer;
		if (initializer !== undefined && ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression)) {
			this.append_file(initializer.expression.text);
		}
	}
}
