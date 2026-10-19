import ts from "typescript";
import { TypeScriptInstanceFileScope } from "src/parser/references/instance/instance-resolution/type_script_instance_file_scope";
import { TypeScriptInstanceClassIdentity } from "src/parser/references/instance/instance-resolution/type_script_instance_class_identity";
import { TypeScriptInstanceFileIdentity } from "src/parser/references/instance/instance-resolution/type_script_instance_file_identity";
import { TypeScriptLexicalScope } from "src/parser/references/instance/type_script_lexical_scope";
import type {
	TypeScriptInstanceFileScopeContract,
	TypeScriptInstanceFilesContract,
	TypeScriptLexicalScopeContract,
	TypeScriptPropertyInstanceFilesContract,
} from "src/model/protocols";

/** Responsibilities: _instance declarations_, _file identities_. **/
export class TypeScriptInstanceFiles implements TypeScriptInstanceFilesContract {
	private readonly imported_binding_files: ReadonlyMap<string, string>;
	private readonly instance_files: Map<ts.Node, TypeScriptInstanceFileScopeContract>;
	private readonly scope_resolver: TypeScriptLexicalScopeContract;
	private readonly properties: TypeScriptPropertyInstanceFilesContract;
	private readonly file_resolver: TypeScriptInstanceFileIdentity;
	private readonly class_resolver: TypeScriptInstanceClassIdentity;

	/** Responsibilities: _scope instance file lookup_. **/
	private scope_files(node: ts.Node): TypeScriptInstanceFileScopeContract {
		let scope = this.scope_resolver.declaration_scope(node);
		if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
			scope = this.scope_resolver.assignment_scope(node);
		}
		let files = this.instance_files.get(scope);
		if (files === undefined) {
			files = new TypeScriptInstanceFileScope(this.imported_binding_files);
			this.instance_files.set(scope, files);
		}
		return files;
	}

	/** Responsibilities: _declaration instance collection_. **/
	private collect_assignment(node: ts.BinaryExpression): void {
		if (!ts.isIdentifier(node.left)) {
			return;
		}
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		const files = this.scope_files(node);
		files.append(node, this.file_resolver.file(node), this.class_resolver.class_name(node));
	}

	/** Responsibilities: _constructor parameter property collection_. **/
	private collect_parameter_property(node: ts.ParameterDeclaration, owner_file: string, owner_class: string): void {
		const constructor = node.parent;
		if (ts.isConstructorDeclaration(constructor) && ts.isParameterPropertyDeclaration(node, constructor)) {
			this.properties.collect(node, owner_file, owner_class);
		}
	}

	/** Responsibilities: _declaration instance collection_. **/
	private collect_declaration(node: ts.Node, owner_file: string, owner_class: string): void {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			const files = this.scope_files(node);
			files.append(node, this.file_resolver.file(node), this.class_resolver.class_name(node));
		}
		if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
			this.collect_assignment(node);
		}
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			this.properties.collect(node, owner_file, owner_class);
		}
		if (ts.isParameter(node)) {
			this.collect_parameter_property(node, owner_file, owner_class);
		}
	}

	/** Responsibilities: _local instance file collection_. **/
	private collect_instance_files(node: ts.Node, owner_file: string, owner_class: string = ""): void {
		if (ts.isClassLike(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
			owner_file = node.getSourceFile().fileName;
			const class_name = node.name;
			owner_class = "";
			if (class_name !== undefined) {
				owner_class = class_name.text;
			}
		}
		this.collect_declaration(node, owner_file, owner_class);
		ts.forEachChild(node, (child) => this.collect_instance_files(child, owner_file, owner_class));
	}

	/** Responsibilities: _instance file state_. **/
	public constructor(
		imported_binding_files: ReadonlyMap<string, string>,
		source_file: ts.SourceFile,
		properties: TypeScriptPropertyInstanceFilesContract,
	) {
		this.imported_binding_files = imported_binding_files;
		this.instance_files = new Map<ts.Node, TypeScriptInstanceFileScopeContract>();
		this.properties = properties;
		this.scope_resolver = new TypeScriptLexicalScope(source_file);
		this.file_resolver = new TypeScriptInstanceFileIdentity(imported_binding_files, this);
		this.class_resolver = new TypeScriptInstanceClassIdentity(this);
	}

	/** Responsibilities: _TypeScript instance file indexing_. **/
	public collect(source_file: ts.SourceFile): void {
		this.collect_instance_files(source_file, source_file.fileName);
	}

	/** Responsibilities: _local instance file resolution_. **/
	public instance_file(name: string, node: ts.Node): string {
		for (const scope of this.scope_resolver.scope_chain(node)) {
			const files = this.instance_files.get(scope);
			if (files === undefined) {
				continue;
			}
			const instance_file = files.file(name, node);
			if (instance_file.bound) {
				return instance_file.value;
			}
		}
		const file = this.imported_binding_files.get(name);
		if (file === undefined) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _local instance class resolution_. **/
	public instance_class(name: string, node: ts.Node): string {
		for (const scope of this.scope_resolver.scope_chain(node)) {
			const files = this.instance_files.get(scope);
			if (files === undefined) {
				continue;
			}
			const class_name = files.class_name(name, node);
			if (class_name.bound) {
				return class_name.value;
			}
		}
		return "";
	}
}
