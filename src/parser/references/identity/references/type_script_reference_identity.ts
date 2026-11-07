import { relative } from "node:path";
import type { CallableReferenceIdentity } from "src/model/ast/normalized_ast_types";
import type {
	TypeScriptInstanceFilesContract,
	TypeScriptPropertyInstanceFilesContract,
	TypeScriptReferenceFileIndexContract,
	TypeScriptReferenceIdentityContract,
} from "src/model/protocols";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import { TypeScriptPropertyInstanceFiles } from "src/parser/references/identity/properties/type_script_property_instance_files";
import { TypeScriptInheritedMethods } from "src/parser/references/identity/references/type_script_inherited_methods";
import { TypeScriptPropertyReferenceIdentity } from "src/parser/references/identity/references/type_script_property_reference_identity";
import { TypeScriptReferenceFileIndex } from "src/parser/references/identity/references/type_script_reference_file_index";
import { TypeScriptInstanceFiles } from "src/parser/references/instance/instance-resolution/type_script_instance_files";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import type { ProjectSourceIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _member identities_, _declaration identities_. **/
export class TypeScriptReferenceIdentity implements TypeScriptReferenceIdentityContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _project_root: string;
	private readonly _module_exports: TypeScriptModuleExportsContract;
	private readonly _instance_files: TypeScriptInstanceFilesContract;
	private readonly _properties: TypeScriptPropertyInstanceFilesContract;
	private readonly _file_index: TypeScriptReferenceFileIndexContract;
	private readonly _this_receiver: TypeScriptThisReceiver;
	private readonly _property_identity: TypeScriptPropertyReferenceIdentity;
	private readonly _inherited_methods: TypeScriptInheritedMethods;

	/** Responsibilities: _class receiver file_. **/
	private receiver_class_file(class_owner_name: string, class_access: ts.AccessExpression): string {
		const receiver_file = this.receiver_file(class_access.expression, class_owner_name);
		if (receiver_file.length === 0) {
			return "";
		}
		const reference = { file: receiver_file, name: class_owner_name };
		const resolved = this._module_exports.resolve(reference);
		const kind = this._module_exports.symbol_kind(resolved);
		if (kind !== "class") {
			return "";
		}
		if (resolved.file.length > 0) {
			return resolved.file;
		}
		return receiver_file;
	}

	/** Responsibilities: _method declaration file_. **/
	private method_file(method_owner_name: string, method_access: ts.AccessExpression): string {
		this._file_index.index_source_file(this._source_file);
		const property_file = this._property_identity.direct_access_file(method_access);
		if (property_file.length > 0) {
			return property_file;
		}
		const class_file = this.receiver_class_file(method_owner_name, method_access);
		if (class_file.length > 0) {
			return this.class_method_file(method_owner_name, method_access, class_file);
		}
		const imported_file = this._file_index.imported_class_file(method_owner_name);
		if (imported_file.length > 0) {
			return imported_file;
		}
		return this._file_index.local_class_file(method_owner_name);
	}

	/** Responsibilities: _class method source lookup_. **/
	private class_method_file(class_owner_name: string, class_access: ts.AccessExpression, class_file: string): string {
		const resolved = this._module_exports.resolve({ file: class_file, name: class_owner_name });
		let class_name = class_owner_name;
		if (resolved.name.length > 0) {
			class_name = resolved.name;
		}
		const inherited_file = this._inherited_methods.file(class_file, class_name, this.member_name(class_access));
		if (inherited_file.length > 0) {
			return inherited_file;
		}
		return class_file;
	}

	/** Responsibilities: _receiver declaration file resolution_. **/
	private receiver_file(receiver_expression: ts.Expression, receiver_owner_name: string): string {
		if (ts.isNewExpression(receiver_expression)) {
			return this._file_index.new_receiver_file(receiver_expression);
		}
		if (ts.isIdentifier(receiver_expression)) {
			return this._instance_files.instance_file(receiver_expression.text, receiver_expression);
		}
		if (ts.isPropertyAccessExpression(receiver_expression)) {
			return this._property_identity.property_receiver_file(receiver_expression);
		}
		if (ts.isElementAccessExpression(receiver_expression)) {
			return this.receiver_file(receiver_expression.expression, receiver_owner_name);
		}
		return "";
	}

	/** Responsibilities: _direct method receiver detection_. **/
	private is_direct_reference(direct_candidate: ts.AccessExpression): boolean {
		if (ts.isIdentifier(direct_candidate.expression)) {
			return true;
		}
		if (ts.isNewExpression(direct_candidate.expression)) {
			return true;
		}
		if (direct_candidate.expression.kind === ts.SyntaxKind.ThisKeyword) {
			return true;
		}
		if (ts.isPropertyAccessExpression(direct_candidate.expression)) {
			return true;
		}
		return ts.isElementAccessExpression(direct_candidate.expression);
	}

	/** Responsibilities: _reference identity source setup_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		const imported_binding_files = new Map<string, string>();
		this._properties = new TypeScriptPropertyInstanceFiles(imported_binding_files);
		this._instance_files = new TypeScriptInstanceFiles(imported_binding_files, source_file, this._properties);
		this._this_receiver = new TypeScriptThisReceiver(source_file, new Map<string, string>());
		this._source_file = source_file;
		this._project_root = project_root;
		const exports_context = new TypeScriptModuleExportsContext(this._project_root, source_files, false, source_io);
		this._module_exports = exports_context.module_exports();
		this._inherited_methods = new TypeScriptInheritedMethods(source_files, this._module_exports);
		this._file_index = new TypeScriptReferenceFileIndex(
			source_file,
			this._module_exports,
			imported_binding_files,
			this._instance_files,
		);
		this._property_identity = new TypeScriptPropertyReferenceIdentity({
			source_file,
			source_files,
			instance_files: this._instance_files,
			properties: this._properties,
			file_index: this._file_index,
			this_receiver: this._this_receiver,
		});
	}

	/** Responsibilities: _access member name_. **/
	public member_name(access_member: ts.AccessExpression): string {
		if (ts.isPropertyAccessExpression(access_member)) {
			return access_member.name.text;
		}
		const argument = access_member.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return "";
	}

	/** Responsibilities: _method reference identity_. **/
	public method_reference(
		reference_access: ts.AccessExpression,
		reference_owner_name: string,
	): CallableReferenceIdentity {
		let target_file = "";
		if (this.is_direct_reference(reference_access)) {
			target_file = this.method_file(reference_owner_name, reference_access);
		}
		let relative_target = "";
		if (target_file.length > 0) {
			relative_target = relative(this._project_root, target_file).replaceAll("\\", "/");
		}
		return { name: this.member_name(reference_access), target_file: relative_target };
	}

	/** Responsibilities: _class receiver classification_. **/
	public class_receiver(name: string): boolean {
		if (this._file_index.imported_class_file(name).length > 0) {
			return true;
		}
		return this._file_index.local_class_file(name).length > 0;
	}
}
