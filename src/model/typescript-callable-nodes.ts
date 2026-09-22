import ts from 'typescript';

import type { AstCallableNode, AstClassNode, AstVisibility } from 'src/types';
import type { TypeScriptCallableData } from 'src/model/typescript-callable-data';
import type { CallableDataOptions } from 'src/model/types';

import type { CallableNodeContext } from 'src/model/types';

/** Responsibilities: _collection TypeScript callable nodes_. **/
export class CallableNodes {
	private readonly callable_data: TypeScriptCallableData;
	/** Responsibilities: _callable initializers identification_. **/
	private is_callable_initializer(
		node: ts.Expression
	): boolean {
		if (ts.isArrowFunction(node)) {
			return true;
		}
		return ts.isFunctionExpression(node);
	}

	/** Responsibilities: _callable class members identification_. **/
	private is_callable_member(member: ts.ClassElement): boolean {
		if (ts.isMethodDeclaration(member)) {
			return true;
		}
		if (ts.isConstructorDeclaration(member)) {
			return true;
		}
		if (ts.isGetAccessorDeclaration(member)) {
			return true;
		}
		if (ts.isSetAccessorDeclaration(member)) {
			return true;
		}
		if (!ts.isPropertyDeclaration(member) || !member.initializer) {
			return false;
		}
		return this.is_callable_initializer(member.initializer);
	}

	/** Responsibilities: _callable member names identification_. **/
	private callable_name(member: ts.ClassElement, source_file: ts.SourceFile): string {
		if (ts.isConstructorDeclaration(member)) {
			return 'constructor';
		}
		if (member.name === undefined) {
			return '';
		}
		return member.name.getText(source_file);
	}

	/** Responsibilities: _resolution callable class member_. **/
	private callable_declaration(member: ts.ClassElement): ts.FunctionLikeDeclaration {
		if (ts.isPropertyDeclaration(member)) {
			const initializer = member.initializer;
if (initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
				return initializer;
			}
		}
if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
			return member;
		}
if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
			return member;
		}
		throw new Error('Callable class member has no callable declaration.');
	}

	/** Responsibilities: _accessor members identification_. **/
	private is_accessor(member: ts.ClassElement): boolean {
		if (ts.isGetAccessorDeclaration(member)) {
			return true;
		}
		return ts.isSetAccessorDeclaration(member);
	}

	/** Responsibilities: _member visibility classification_. **/
	private member_visibility(member: ts.ClassElement): AstVisibility {
		if (member.name && ts.isPrivateIdentifier(member.name)) {
			return 'private';
		}
		if (this.has_modifier(member, ts.SyntaxKind.PrivateKeyword)) {
			return 'private';
		}
		if (this.has_modifier(member, ts.SyntaxKind.ProtectedKeyword)) {
			return 'protected';
		}
		return 'public';
	}

	/** Responsibilities: _member modifier identification_. **/
	private has_modifier(member: ts.ClassElement, kind: ts.SyntaxKind): boolean {
		if (!ts.canHaveModifiers(member)) {
			return false;
		}
		const modifiers = ts.getModifiers(member);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some(modifier => modifier.kind === kind);
	}

	/** Responsibilities: _construction callable AST node_. **/
	private callable_node(
		callable_data: TypeScriptCallableData,
		source_file: ts.SourceFile,
		member: ts.ClassElement,
		owner: string
	): AstCallableNode {
		const name = this.callable_name(member, source_file);
		const node = this.callable_declaration(member);
		const options = {
			name,
			node,
			visibility: this.member_visibility(member),
			owner,
		} satisfies CallableDataOptions;
		return {
			...callable_data.callable_node(options),
			is_accessor: this.is_accessor(member),
		};
	}

	/** Responsibilities: _construction interface method AST_. **/
	private interface_method_nodes(
		callable_data: TypeScriptCallableData,
		source_file: ts.SourceFile,
		node: ts.InterfaceDeclaration
	): AstCallableNode[] {
		return node.members.flatMap(member => {
			if (!ts.isMethodSignature(member) || !member.name) {
				return [];
			}
			return [
				callable_data.callable_node({
					name: member.name.getText(source_file),
					node: member,
					visibility: 'public',
					owner: '',
				}),
			];
		});
	}

	/** Responsibilities: _callable node construction initialization_. **/
	public constructor(callable_data: TypeScriptCallableData) {
		this.callable_data = callable_data;
	}

	/** Responsibilities: _construction interface AST class_. **/
	public interface_node(context: CallableNodeContext, node: ts.InterfaceDeclaration): AstClassNode {
		const { source_file } = context;
		return {
			name: node.name.text,
			start: source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line,
			end: source_file.getLineAndCharacterOfPosition(node.end - 1).line,
			lines: 0,
			sloc: 1,
			interfaces: [],
			base_class_name: '',
			base_class_names: [],
			extends_external_class: false,
			type_contract: true,
			is_data_class: false,
			protocol: false,
			methods: this.interface_method_nodes(this.callable_data, source_file, node),
			fields: [],
			callback_fields: 0,
			inline_callback_fields: 0,
			dependencies: [],
			untyped_fields: [],
		};
	}

	/** Responsibilities: _construction class method AST_. **/
	public class_method_nodes(
		context: CallableNodeContext,
		node: ts.ClassLikeDeclaration,
		fallback_name: string
	): AstCallableNode[] {
		const { source_file } = context;
		let owner = fallback_name;
		if (node.name !== undefined) {
			owner = node.name.text;
		}
		return node.members
			.filter(member => this.is_callable_member(member))
			.map(member => this.callable_node(this.callable_data, source_file, member, owner));
	}

	/** Responsibilities: _construction variable callable AST_. **/
	public variable_callable_nodes(
		context: CallableNodeContext,
		statement: ts.VariableStatement
	): AstCallableNode[] {
		const { source_file } = context;
		return statement.declarationList.declarations.flatMap(declaration => {
			const initializer = declaration.initializer;
if (initializer === undefined || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) {
			return [];
		}
			return [
				this.callable_data.callable_node({
					name: declaration.name.getText(source_file),
					node: initializer,
					visibility: 'public',
					owner: '',
				}),
			];
		});
	}

	/** Responsibilities: _construction function declaration AST_. **/
	public function_declaration_node(statement: ts.FunctionDeclaration): AstCallableNode {
		let name = '';
		if (statement.name !== undefined) {
			name = statement.name.text;
		}
		const options = {
			name,
			node: statement,
			visibility: 'public',
			owner: '',
		} satisfies CallableDataOptions;
		return this.callable_data.callable_node(options);
	}
}
