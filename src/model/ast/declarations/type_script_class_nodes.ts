import ts from "typescript";

import { ANONYMOUS_CLASS_NAME } from "src/constants";
import { TypeScriptClassDeclarationMetadata } from "src/model/ast/declarations/type_script_class_declaration_metadata";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { TypeScriptClassCallableNodesContract } from "src/model/protocols";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import { TypeScriptAstNodeObserverRegistry } from "src/parser/analysis/type_script_ast_node_observer_registry";
import { TypeScriptClassMembers } from "src/parser/analysis/type_script_class_members";
import type { TypeScriptClassMembersContract, TypeScriptClassNodesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _class node collection_, _interface node collection_. **/
export class TypeScriptClassNodes implements TypeScriptClassNodesContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _callable_nodes: TypeScriptClassCallableNodesContract;
	private readonly _member_data: TypeScriptClassMembersContract;
	private readonly _traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _interface metadata construction_. **/
	private interface_node(node: ts.InterfaceDeclaration): AstClassNode {
		const interface_node = this._callable_nodes.interface_node(node);
		return {
			...interface_node,
			field_analysis: {
				...interface_node.field_analysis,
				fields: this._member_data.interface_fields(node),
			},
		};
	}

	/** Responsibilities: _class expression name resolution_. **/
	private class_expression_node(node: ts.ClassExpression): AstClassNode {
		let fallback_name = "";
		const parent = node.parent;
		if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
			fallback_name = parent.name.getText(this._source_file);
		}
		return this.class_node(node, fallback_name);
	}

	/** Responsibilities: _class node metadata_. **/
	private class_node(class_declaration: ts.ClassLikeDeclaration, fallback_name: string): AstClassNode {
		const metadata = new TypeScriptClassDeclarationMetadata({
			class_declaration,
			fallback_name,
			source_file: this._source_file,
			callable_nodes: this._callable_nodes,
			member_data: this._member_data,
		});
		const sections = metadata.sections();
		return { identity: metadata.identity(), ...sections };
	}

	/** Responsibilities: _class analyzer initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		callable_nodes: TypeScriptClassCallableNodesContract,
		traversal: TypeScriptAstTraversalContract,
	) {
		this._source_file = source_file;
		this._callable_nodes = callable_nodes;
		this._member_data = new TypeScriptClassMembers(source_file);
		this._traversal = traversal;
	}

	/** Responsibilities: _declaration kind dispatch_. **/
	public append_node(node: ts.Node, declarations: AstClassNode[]): void {
		if (ts.isInterfaceDeclaration(node)) {
			declarations.push(this.interface_node(node));
			return;
		}
		if (ts.isClassDeclaration(node)) {
			declarations.push(this.class_node(node, ANONYMOUS_CLASS_NAME));
			return;
		}
		if (!ts.isClassExpression(node)) {
			return;
		}
		declarations.push(this.class_expression_node(node));
	}

	/** Responsibilities: _class-like metadata construction_. **/
	public declaration_nodes(): AstClassNode[] {
		const declarations: AstClassNode[] = [];
		const dispatcher = new TypeScriptAstNodeObserverRegistry<void>();
		dispatcher.register(
			TypeScriptAstDispatchPhase.SourceMetadata,
			[ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.ClassExpression, ts.SyntaxKind.InterfaceDeclaration],
			({ node }) => this.append_node(node, declarations),
		);
		dispatcher.dispatch(TypeScriptAstDispatchPhase.SourceMetadata, this._traversal, this._source_file, undefined);
		return declarations;
	}
}
