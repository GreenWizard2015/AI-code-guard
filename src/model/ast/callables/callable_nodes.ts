import type { CallableNodesContract } from "src/analysis_protocols";
import { PROTECTED_VISIBILITY } from "src/constants";
import { CONSTRUCTOR_NAME } from "src/metrics/constants";
import type { AstCallableNode, AstClassNode, AstVisibility } from "src/model/ast/normalized_ast_types";
import type { ClassCallableNodeCollection, TypeScriptCallableDataContract } from "src/model/protocols";
import type { CallableDataOptions, ClassCallableNodeOptions } from "src/model/types";
import ts from "typescript";

/** Responsibilities: _callable AST extraction_, _callable metadata classification_. **/
export class CallableNodes implements CallableNodesContract {
	private readonly _callable_data: TypeScriptCallableDataContract;
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _callable declaration metadata_. **/
	private callable_declaration(node: AstCallableNode, accessor: boolean): AstCallableNode {
		return {
			...node,
			declaration: {
				...node.declaration,
				is_accessor: accessor,
			},
		};
	}

	/** Responsibilities: _callable class member collection_. **/
	private append_callable_member(member: ts.ClassElement, collection: ClassCallableNodeCollection): void {
		if (ts.isConstructorDeclaration(member)) {
			collection.callables.push(
				this.callable_node({ member, callable: member, name: CONSTRUCTOR_NAME, owner: collection.owner }),
			);
			return;
		}
		if (this.append_named_callable(member, collection)) {
			return;
		}
		if (ts.isPropertyDeclaration(member)) {
			this.append_callable_property(member, collection.owner, collection.callables);
		}
	}

	/** Responsibilities: _method and accessor collection_. **/
	private append_named_callable(candidate: ts.Node, collection: ClassCallableNodeCollection): boolean {
		if (ts.isMethodDeclaration(candidate)) {
			const name = candidate.name.getText(this._source_file);
			collection.callables.push(
				this.callable_node({ member: candidate, callable: candidate, name, owner: collection.owner }),
			);
			return true;
		}
		if (ts.isGetAccessorDeclaration(candidate) || ts.isSetAccessorDeclaration(candidate)) {
			const name = candidate.name.getText(this._source_file);
			collection.callables.push(
				this.callable_node({ member: candidate, callable: candidate, name, owner: collection.owner }),
			);
			return true;
		}
		return false;
	}

	/** Responsibilities: _callable property collection_. **/
	private append_callable_property(
		property: ts.PropertyDeclaration,
		owner: string,
		callables: AstCallableNode[],
	): void {
		const initializer = property.initializer;
		if (initializer === undefined) {
			return;
		}
		if (ts.isArrowFunction(initializer)) {
			const name = property.name.getText(this._source_file);
			callables.push(this.callable_node({ member: property, callable: initializer, name, owner }));
			return;
		}
		if (!ts.isFunctionExpression(initializer)) {
			return;
		}
		const name = property.name.getText(this._source_file);
		callables.push(this.callable_node({ member: property, callable: initializer, name, owner }));
	}

	/** Responsibilities: _class member visibility_. **/
	private member_visibility(member: ts.ClassElement): AstVisibility {
		if (member.name && ts.isPrivateIdentifier(member.name)) {
			return "private";
		}
		if (ts.canHaveModifiers(member)) {
			const modifiers = ts.getModifiers(member);
			if (modifiers !== undefined) {
				if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
					return "private";
				}
				if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
					return PROTECTED_VISIBILITY;
				}
			}
		}
		return "public";
	}

	/** Responsibilities: _callable AST node construction_. **/
	private callable_node(options: ClassCallableNodeOptions): AstCallableNode {
		const { member, callable, name, owner } = options;
		const callable_options = {
			name,
			node: callable,
			visibility: this.member_visibility(member),
			owner,
		} satisfies CallableDataOptions;
		const is_accessor = ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member);
		return this.callable_declaration(this._callable_data.callable_node(callable_options), is_accessor);
	}

	/** Responsibilities: _construction interface method AST_. **/
	private interface_method_nodes(node: ts.InterfaceDeclaration): AstCallableNode[] {
		return node.members.flatMap((member) => {
			if (!ts.isMethodSignature(member) || !member.name) {
				return [];
			}
			return [
				this._callable_data.callable_node({
					name: member.name.getText(this._source_file),
					node: member,
					visibility: "public",
					owner: "",
				}),
			];
		});
	}

	/** Responsibilities: _callable node construction initialization_. **/
	public constructor(callable_data: TypeScriptCallableDataContract, source_file: ts.SourceFile) {
		this._callable_data = callable_data;
		this._source_file = source_file;
	}

	/** Responsibilities: _construction interface AST class_. **/
	public interface_node(node: ts.InterfaceDeclaration): AstClassNode {
		const source_file = this._source_file;
		const base_class_names = (node.heritageClauses ?? []).flatMap((clause) => {
			if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
				return [];
			}
			return clause.types.map((type) => type.expression.getText(source_file));
		});
		return {
			identity: {
				name: node.name.text,
				start: source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line,
				end: source_file.getLineAndCharacterOfPosition(node.end - 1).line,
				lines: 0,
				sloc: 1,
			},
			structure: {
				interfaces: [],
				base_class_names,
				methods: this.interface_method_nodes(node),
				dependencies: [],
			},
			classification: { extends_external_class: false, type_contract: true, is_data_class: false, protocol: false },
			field_analysis: { fields: [], callback_fields: 0, inline_callback_fields: 0, untyped_fields: [] },
		};
	}

	/** Responsibilities: _construction class method AST_. **/
	public class_method_nodes(node: ts.ClassLikeDeclaration, fallback_name: string): AstCallableNode[] {
		let owner = fallback_name;
		if (node.name !== undefined) {
			owner = node.name.text;
		}
		const collection = { owner, callables: [] } satisfies ClassCallableNodeCollection;
		for (const member of node.members) {
			this.append_callable_member(member, collection);
		}
		return collection.callables;
	}

	/** Responsibilities: _construction variable callable AST_. **/
	public variable_callable_nodes(statement: ts.VariableStatement): AstCallableNode[] {
		const source_file = this._source_file;
		return statement.declarationList.declarations.flatMap((declaration) => {
			const initializer = declaration.initializer;
			if (initializer === undefined || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) {
				return [];
			}
			return [
				this._callable_data.callable_node({
					name: declaration.name.getText(source_file),
					node: initializer,
					visibility: "public",
					owner: "",
				}),
			];
		});
	}

	/** Responsibilities: _construction function declaration AST_. **/
	public function_declaration_node(statement: ts.FunctionDeclaration): AstCallableNode {
		let name = "";
		if (statement.name !== undefined) {
			name = statement.name.text;
		}
		const options = {
			name,
			node: statement,
			visibility: "public",
			owner: "",
		} satisfies CallableDataOptions;
		return this._callable_data.callable_node(options);
	}
}
