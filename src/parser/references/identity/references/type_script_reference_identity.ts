import { relative } from "node:path";
import ts from "typescript";
import { CONTRACT_SUFFIX } from "src/metrics/constants";
import type { CallableReferenceIdentity } from "src/types";
import type {
	TypeScriptInstanceFilesContract,
	TypeScriptPropertyInstanceFilesContract,
	TypeScriptReferenceFileIndexContract,
	TypeScriptReferenceIdentityContract,
} from "src/model/protocols";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import { TypeScriptInstanceFiles } from "src/parser/references/instance/instance-resolution/type_script_instance_files";
import { TypeScriptPropertyInstanceFiles } from "src/parser/references/identity/properties/type_script_property_instance_files";
import { TypeScriptReferenceFileIndex } from "src/parser/references/identity/references/type_script_reference_file_index";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import { TypeScriptInheritedMethods } from "src/parser/references/identity/references/type_script_inherited_methods";
import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";
import type { TypeScriptPropertySide } from "src/types";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _member identities_, _declaration identities_. **/
export class TypeScriptReferenceIdentity implements TypeScriptReferenceIdentityContract {
	private readonly source_file: ts.SourceFile;
	private readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly project_root: string;
	private readonly module_exports: TypeScriptModuleExportsContract;
	private readonly instance_files: TypeScriptInstanceFilesContract;
	private readonly properties: TypeScriptPropertyInstanceFilesContract;
	private readonly file_index: TypeScriptReferenceFileIndexContract;
	private readonly this_receiver: TypeScriptThisReceiver;
	private readonly inherited_methods: TypeScriptInheritedMethods;

	/** Responsibilities: _class receiver file_. **/
	private receiver_class_file(owner: string, expression: ts.AccessExpression): string {
		const receiver_file = this.receiver_file(expression.expression, owner);
		if (receiver_file.length === 0) {
			return "";
		}
		const kind = this.module_exports.symbol_kind(receiver_file, owner);
		if (kind !== "class") {
			return "";
		}
		const resolved = this.module_exports.resolve(receiver_file, owner);
		if (resolved.file.length > 0) {
			return resolved.file;
		}
		return receiver_file;
	}

	/** Responsibilities: _imported property resolution_. **/
	private imported_property_file(
		owner_file: string,
		owner_class: string,
		name: string,
		side: TypeScriptPropertySide,
	): string {
		const imported_source = this.source_files.get(owner_file);
		if (imported_source !== undefined) {
			this.file_index.index_source_file(imported_source);
		}
		return this.properties.file(owner_file, owner_class, name, side);
	}

	/** Responsibilities: _class property declaration name_. **/
	private class_name(owner_file: string, fallback: string): string {
		const source = this.source_files.get(owner_file);
		if (source === undefined) {
			return fallback;
		}
		for (const statement of source.statements) {
			if (ts.isClassLike(statement) === false) {
				continue;
			}
			if (statement.name === undefined) {
				continue;
			}
			if (statement.name.text === fallback) {
				return fallback;
			}
		}
		return fallback;
	}

	/** Responsibilities: _static property declaration file_. **/
	private static_property_file(expression: ts.PropertyAccessExpression): string {
		if (!ts.isIdentifier(expression.expression)) {
			return "";
		}
		const owner = expression.expression.text;
		let owner_file = this.file_index.imported_class_file(owner);
		if (owner_file.length === 0) {
			owner_file = this.file_index.local_class_file(owner);
		}
		if (owner_file.length === 0) {
			return "";
		}
		return this.properties.file(
			owner_file,
			this.class_name(owner_file, owner),
			expression.name.text,
			STATIC_PROPERTY_SIDE,
		);
	}

	/** Responsibilities: _method declaration file_. **/
	private direct_property_file(expression: ts.AccessExpression): string {
		if (ts.isPropertyAccessExpression(expression.expression)) {
			const property_file = this.property_receiver_file(expression.expression);
			if (property_file.length > 0) {
				return property_file;
			}
		}
		return "";
	}

	/** Responsibilities: _method declaration file_. **/
	private method_file(owner: string, expression: ts.AccessExpression): string {
		this.file_index.index_source_file(this.source_file);
		const property_file = this.direct_property_file(expression);
		if (property_file.length > 0) {
			return property_file;
		}
		const class_file = this.receiver_class_file(owner, expression);
		if (class_file.length > 0) {
			return this.class_method_file(owner, expression, class_file);
		}
		const imported_file = this.file_index.imported_class_file(owner);
		if (imported_file.length > 0) {
			return imported_file;
		}
		return this.file_index.local_class_file(owner);
	}

	/** Responsibilities: _class method source lookup_. **/
	private class_method_file(owner: string, expression: ts.AccessExpression, class_file: string): string {
		const resolved = this.module_exports.resolve(class_file, owner);
		let class_name = owner;
		if (resolved.name.length > 0) {
			class_name = resolved.name;
		}
		const inherited_file = this.inherited_methods.file(class_file, class_name, this.member_name(expression));
		if (inherited_file.length > 0) {
			return inherited_file;
		}
		return class_file;
	}

	/** Responsibilities: _property receiver file resolution_. **/
	private this_property_file(expression: ts.PropertyAccessExpression): string {
		return this.properties.file(
			this.source_file.fileName,
			this.this_receiver.owner(expression.expression),
			expression.name.text,
			this.this_receiver.side(expression.expression),
		);
	}

	/** Responsibilities: _new property receiver file_. **/
	private new_property_file(expression: ts.PropertyAccessExpression): string {
		const new_expression = expression.expression;
		if (!ts.isNewExpression(new_expression)) {
			return "";
		}
		if (!ts.isIdentifier(new_expression.expression)) {
			return "";
		}
		const owner_file = this.file_index.new_receiver_file(new_expression);
		return this.imported_property_file(
			owner_file,
			new_expression.expression.text,
			expression.name.text,
			INSTANCE_PROPERTY_SIDE,
		);
	}

	/** Responsibilities: _instance property receiver file_. **/
	private instance_property_file(expression: ts.PropertyAccessExpression): string {
		const receiver = expression.expression;
		if (!ts.isIdentifier(receiver)) {
			return "";
		}
		const instance_file = this.instance_files.instance_file(receiver.text, expression);
		if (instance_file.length === 0) {
			return "";
		}
		const instance_class = this.instance_files.instance_class(receiver.text, expression);
		return this.imported_property_file(instance_file, instance_class, expression.name.text, INSTANCE_PROPERTY_SIDE);
	}

	/** Responsibilities: _property receiver file resolution_. **/
	private property_receiver_file(expression: ts.PropertyAccessExpression): string {
		if (expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
			return this.this_property_file(expression);
		}
		if (ts.isNewExpression(expression.expression)) {
			return this.new_property_file(expression);
		}
		const static_file = this.static_property_file(expression);
		if (static_file.length > 0) {
			return static_file;
		}
		return this.instance_property_file(expression);
	}

	/** Responsibilities: _receiver declaration file resolution_. **/
	private receiver_file(expression: ts.Expression, owner: string): string {
		if (ts.isNewExpression(expression)) {
			return this.file_index.new_receiver_file(expression);
		}
		if (ts.isIdentifier(expression)) {
			return this.instance_files.instance_file(expression.text, expression);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.property_receiver_file(expression);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.receiver_file(expression.expression, owner);
		}
		return "";
	}

	/** Responsibilities: _direct method receiver detection_. **/
	private is_direct_reference(expression: ts.AccessExpression): boolean {
		if (ts.isIdentifier(expression.expression)) {
			return true;
		}
		if (ts.isNewExpression(expression.expression)) {
			return true;
		}
		if (expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
			return true;
		}
		if (ts.isPropertyAccessExpression(expression.expression)) {
			return true;
		}
		return ts.isElementAccessExpression(expression.expression);
	}

	/** Responsibilities: _reference identity source setup_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		const imported_binding_files = new Map<string, string>();
		this.properties = new TypeScriptPropertyInstanceFiles(imported_binding_files);
		this.instance_files = new TypeScriptInstanceFiles(imported_binding_files, source_file, this.properties);
		this.this_receiver = new TypeScriptThisReceiver(source_file, new Map<string, string>());
		this.source_file = source_file;
		this.source_files = source_files;
		this.project_root = project_root;
		this.module_exports = new TypeScriptModuleExports(this.project_root, source_files, false, source_io);
		this.inherited_methods = new TypeScriptInheritedMethods(source_files, this.module_exports);
		this.file_index = new TypeScriptReferenceFileIndex(
			source_file,
			this.module_exports,
			imported_binding_files,
			this.instance_files,
		);
	}

	/** Responsibilities: _access member name_. **/
	public member_name(expression: ts.AccessExpression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return "";
	}

	/** Responsibilities: _method reference identity_. **/
	public method_reference(expression: ts.AccessExpression, owner: string): CallableReferenceIdentity {
		let target_file = "";
		if (!owner.endsWith(CONTRACT_SUFFIX)) {
			if (this.is_direct_reference(expression)) {
				target_file = this.method_file(owner, expression);
			}
		}
		let relative_target = "";
		if (target_file.length > 0) {
			relative_target = relative(this.project_root, target_file).replaceAll("\\", "/");
		}
		return { name: this.member_name(expression), target_file: relative_target };
	}

	/** Responsibilities: _class receiver classification_. **/
	public class_receiver(name: string): boolean {
		if (this.file_index.imported_class_file(name).length > 0) {
			return true;
		}
		return this.file_index.local_class_file(name).length > 0;
	}
}
