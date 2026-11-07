import type {
	TypeScriptInstanceFileScopeContract,
	TypeScriptInstanceFilesContract,
	TypeScriptInstanceOwner,
	TypeScriptLexicalScopeContract,
	TypeScriptPropertyInstanceFilesContract,
} from "src/model/protocols";
import { TypeScriptInstanceClassIdentity } from "src/parser/references/instance/instance-resolution/type_script_instance_class_identity";
import { TypeScriptInstanceFileIdentity } from "src/parser/references/instance/instance-resolution/type_script_instance_file_identity";
import { TypeScriptInstanceFileScope } from "src/parser/references/instance/instance-resolution/type_script_instance_file_scope";
import { TypeScriptLexicalScope } from "src/parser/references/instance/type_script_lexical_scope";
import ts from "typescript";

/** Responsibilities: _instance declarations_, _file identities_. **/
export class TypeScriptInstanceFiles implements TypeScriptInstanceFilesContract {
	private readonly _imported_binding_files: ReadonlyMap<string, string>;
	private readonly _instance_files: Map<ts.Node, TypeScriptInstanceFileScopeContract>;
	private readonly _scope_resolver: TypeScriptLexicalScopeContract;
	private readonly _properties: TypeScriptPropertyInstanceFilesContract;
	private readonly _file_resolver: TypeScriptInstanceFileIdentity;
	private readonly _class_resolver: TypeScriptInstanceClassIdentity;

	/** Responsibilities: _scope instance file lookup_. **/
	private scope_files(scope_node: ts.Node): TypeScriptInstanceFileScopeContract {
		let scope = this._scope_resolver.declaration_scope(scope_node);
		if (ts.isBinaryExpression(scope_node) && ts.isIdentifier(scope_node.left)) {
			scope = this._scope_resolver.assignment_scope(scope_node);
		}
		let files = this._instance_files.get(scope);
		if (files === undefined) {
			files = new TypeScriptInstanceFileScope(this._imported_binding_files);
			this._instance_files.set(scope, files);
		}
		return files;
	}

	/** Responsibilities: _declaration instance collection_. **/
	private collect_assignment(assignment_node: ts.BinaryExpression): void {
		if (!ts.isIdentifier(assignment_node.left)) {
			return;
		}
		if (assignment_node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		const files = this.scope_files(assignment_node);
		files.append(
			assignment_node,
			this._file_resolver.file(assignment_node),
			this._class_resolver.class_name(assignment_node),
		);
	}

	/** Responsibilities: _constructor parameter property collection_. **/
	private collect_parameter_property(
		parameter_declaration: ts.ParameterDeclaration,
		parameter_owner: TypeScriptInstanceOwner,
	): void {
		const parent = parameter_declaration.parent;
		if (!ts.isConstructorDeclaration(parent)) {
			return;
		}
		if (!ts.isParameterPropertyDeclaration(parameter_declaration, parent)) {
			return;
		}
		this._properties.collect(parameter_declaration, parameter_owner.owner_file, parameter_owner.owner_class);
	}

	/** Responsibilities: _declaration instance collection_. **/
	private collect_declaration(declaration_node: ts.Node, declaration_owner: TypeScriptInstanceOwner): void {
		if (ts.isVariableDeclaration(declaration_node) || ts.isParameter(declaration_node)) {
			const files = this.scope_files(declaration_node);
			files.append(
				declaration_node,
				this._file_resolver.file(declaration_node),
				this._class_resolver.class_name(declaration_node),
			);
		}
		if (ts.isBinaryExpression(declaration_node) && ts.isIdentifier(declaration_node.left)) {
			this.collect_assignment(declaration_node);
		}
		if (ts.isPropertyDeclaration(declaration_node) || ts.isPropertySignature(declaration_node)) {
			this._properties.collect(declaration_node, declaration_owner.owner_file, declaration_owner.owner_class);
		}
		if (ts.isParameter(declaration_node)) {
			this.collect_parameter_property(declaration_node, declaration_owner);
		}
	}

	/** Responsibilities: _named declaration instance ownership_. **/
	private declaration_owner(declaration: ts.NamedDeclaration): TypeScriptInstanceOwner {
		let owner_class = "";
		if (declaration.name !== undefined) {
			owner_class = declaration.name.getText();
		}
		return {
			owner_file: declaration.getSourceFile().fileName,
			owner_class,
		};
	}

	/** Responsibilities: _instance file state_. **/
	public constructor(
		imported_binding_files: ReadonlyMap<string, string>,
		source_file: ts.SourceFile,
		properties: TypeScriptPropertyInstanceFilesContract,
	) {
		this._imported_binding_files = imported_binding_files;
		this._instance_files = new Map<ts.Node, TypeScriptInstanceFileScopeContract>();
		this._properties = properties;
		this._scope_resolver = new TypeScriptLexicalScope(source_file);
		this._file_resolver = new TypeScriptInstanceFileIdentity(imported_binding_files, this);
		this._class_resolver = new TypeScriptInstanceClassIdentity(this);
	}

	/** Responsibilities: _local instance file collection_. **/
	public collect(tree_node: ts.Node, tree_owner: TypeScriptInstanceOwner, local_class_names: Set<string>): void {
		let current_owner = tree_owner;
		if (ts.isClassLike(tree_node)) {
			current_owner = this.declaration_owner(tree_node);
			const class_name = tree_node.name?.text;
			if (class_name !== undefined) {
				local_class_names.add(class_name);
			}
		} else if (ts.isInterfaceDeclaration(tree_node)) {
			current_owner = this.declaration_owner(tree_node);
		} else if (ts.isTypeAliasDeclaration(tree_node)) {
			current_owner = this.declaration_owner(tree_node);
		}
		this.collect_declaration(tree_node, current_owner);
		ts.forEachChild(tree_node, (child) => this.collect(child, current_owner, local_class_names));
	}

	/** Responsibilities: _local instance file resolution_. **/
	public instance_file(file_name: string, file_query: ts.Node): string {
		for (const scope of this._scope_resolver.scope_chain(file_query)) {
			const files = this._instance_files.get(scope);
			if (files === undefined) {
				continue;
			}
			const instance_file = files.file(file_name, file_query);
			if (instance_file.bound) {
				return instance_file.value;
			}
		}
		const file = this._imported_binding_files.get(file_name);
		if (file === undefined) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _local instance class resolution_. **/
	public instance_class(class_name: string, class_query: ts.Node): string {
		for (const scope of this._scope_resolver.scope_chain(class_query)) {
			const files = this._instance_files.get(scope);
			if (files === undefined) {
				continue;
			}
			const class_lookup = files.class_name(class_name, class_query);
			if (class_lookup.bound) {
				return class_lookup.value;
			}
		}
		return "";
	}
}
