import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";
import type {
	TypeScriptInstanceFilesContract,
	TypeScriptPropertyInstanceFilesContract,
	TypeScriptPropertyReference,
	TypeScriptReferenceFileIndexContract,
} from "src/model/protocols";
import type { TypeScriptThisReceiverContract } from "src/parser/references/identity/references/protocols";
import type { TypeScriptPropertyReferenceIdentityOptions } from "src/parser/references/identity/references/protocols";
import ts from "typescript";

/** Responsibilities: _property reference file identity_, _property declaration lookup_. **/
export class TypeScriptPropertyReferenceIdentity {
	private readonly _source_file: ts.SourceFile;
	private readonly _source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly _instance_files: TypeScriptInstanceFilesContract;
	private readonly _properties: TypeScriptPropertyInstanceFilesContract;
	private readonly _file_index: TypeScriptReferenceFileIndexContract;
	private readonly _this_receiver: TypeScriptThisReceiverContract;

	/** Responsibilities: _imported property declaration lookup_. **/
	private imported_property_file(reference: TypeScriptPropertyReference): string {
		const imported_source = this._source_files.get(reference.owner_file);
		if (imported_source !== undefined) {
			this._file_index.index_source_file(imported_source);
		}
		return this._properties.file(reference.owner_file, reference.owner_class, reference.name, reference.side);
	}

	/** Responsibilities: _static property file lookup_. **/
	private static_property_file(owner_name: string, property_name: string): string {
		let owner_file = this._file_index.imported_class_file(owner_name);
		if (owner_file.length === 0) {
			owner_file = this._file_index.local_class_file(owner_name);
		}
		if (owner_file.length === 0) {
			return "";
		}
		return this._properties.file(owner_file, owner_name, property_name, STATIC_PROPERTY_SIDE);
	}

	/** Responsibilities: _new-expression property lookup_. **/
	private new_property_file(new_expression: ts.NewExpression, property_name: string): string {
		if (!ts.isIdentifier(new_expression.expression)) {
			return "";
		}
		return this.imported_property_file({
			owner_file: this._file_index.new_receiver_file(new_expression),
			owner_class: new_expression.expression.text,
			name: property_name,
			side: INSTANCE_PROPERTY_SIDE,
		});
	}

	/** Responsibilities: _instance property declaration file_. **/
	private instance_property_file(receiver: ts.Identifier, property_access: ts.PropertyAccessExpression): string {
		const instance_file = this._instance_files.instance_file(receiver.text, property_access);
		if (instance_file.length === 0) {
			return "";
		}
		return this.imported_property_file({
			owner_file: instance_file,
			owner_class: this._instance_files.instance_class(receiver.text, property_access),
			name: property_access.name.text,
			side: INSTANCE_PROPERTY_SIDE,
		});
	}

	/** Responsibilities: _property reference owner initialization_. **/
	public constructor(options: TypeScriptPropertyReferenceIdentityOptions) {
		this._source_file = options.source_file;
		this._source_files = options.source_files;
		this._instance_files = options.instance_files;
		this._properties = options.properties;
		this._file_index = options.file_index;
		this._this_receiver = options.this_receiver;
	}

	/** Responsibilities: _property receiver file lookup_. **/
	public property_receiver_file(access: ts.PropertyAccessExpression): string {
		if (access.expression.kind === ts.SyntaxKind.ThisKeyword) {
			return this._properties.file(
				this._source_file.fileName,
				this._this_receiver.owner(access.expression),
				access.name.text,
				this._this_receiver.side(access.expression),
			);
		}
		if (ts.isNewExpression(access.expression)) {
			return this.new_property_file(access.expression, access.name.text);
		}
		if (ts.isIdentifier(access.expression)) {
			const static_file = this.static_property_file(access.expression.text, access.name.text);
			if (static_file.length > 0) {
				return static_file;
			}
			return this.instance_property_file(access.expression, access);
		}
		return "";
	}

	/** Responsibilities: _direct property file lookup_. **/
	public direct_access_file(access: ts.AccessExpression): string {
		if (!ts.isPropertyAccessExpression(access.expression)) {
			return "";
		}
		return this.property_receiver_file(access.expression);
	}
}
