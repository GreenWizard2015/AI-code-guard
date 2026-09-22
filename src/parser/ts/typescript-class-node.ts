import ts from 'typescript';

import type { AstCallableNode, AstClassNode } from 'src/types';
import type { CallableNodes } from 'src/model/typescript-callable-nodes';
import { TypeScriptClassMembers } from 'src/parser/ts/typescript-class-members';

import type { ClassLineRange, ClassNodeData, ClassNodeOptions } from 'src/types';

/** Responsibilities: _TypeScript class metrics construction_. **/
export class TypeScriptClassNodes {
	private readonly source_file: ts.SourceFile;
	private readonly callable_nodes: CallableNodes;
	private readonly member_data: TypeScriptClassMembers;

	/** Responsibilities: _class expressions extraction_. **/
	private variable_class_nodes(statement: ts.VariableStatement): AstClassNode[] {
		const classes: AstClassNode[] = [];
		for (const declaration of statement.declarationList.declarations) {
			const initializer = declaration.initializer;
if (initializer !== undefined && ts.isClassExpression(initializer)) {
				classes.push(this.class_node(initializer, declaration.name.getText(this.source_file)));
			}
		}
		return classes;
	}

	/** Responsibilities: _combine class data_. **/
	private class_node(
		node: ts.ClassLikeDeclaration,
		fallback_name = '<anonymous>'
	): AstClassNode {
		const methods = this.callable_nodes.class_method_nodes(
			{ source_file: this.source_file },
			node,
			fallback_name
		);
		const range = this.class_line_range(node);
		const interfaces = this.implemented_interfaces(node);
		return this.build_class_node({
			node,
			fallback_name,
			methods,
			range,
			interfaces,
		});
	}

	/** Responsibilities: _class line range calculation_. **/
	private class_line_range(node: ts.Node): ClassLineRange {
		const start_position = node.getStart(this.source_file);
		const end_position = Math.max(start_position, node.end - 1);
		return {
			start: this.source_file.getLineAndCharacterOfPosition(start_position).line,
			end: this.source_file.getLineAndCharacterOfPosition(end_position).line,
		};
	}

	/** Responsibilities: _implemented interfaces collection_. **/
	private implemented_interfaces(node: ts.ClassLikeDeclaration): string[] {
		const interfaces: string[] = [];
		const clauses = node.heritageClauses;
		if (clauses === undefined) {
			return interfaces;
		}
		for (const clause of clauses) {
			if (clause.token !== ts.SyntaxKind.ImplementsKeyword) {
				continue;
			}
			interfaces.push(...clause.types.map(type => type.expression.getText(this.source_file)));
		}
		return interfaces;
	}

	/** Responsibilities: _class metrics assembly_. **/
	private build_class_node(options: ClassNodeOptions): AstClassNode {
		const callbacks = this.member_data.callback_counts(options.node);
		const fields = this.member_data.class_fields(options.node);
		return {
			...this.class_data(options),
			base_class_names: [],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: callbacks.total,
			inline_callback_fields: callbacks.inline,
			fields,
			untyped_fields: [],
			dependencies: [],
		};
	}

	/** Responsibilities: _derive class identity_. **/
	private class_data(options: ClassNodeOptions): ClassNodeData {
		const start = options.range.start;
		const end = options.range.end;
		let name = options.fallback_name;
		if (options.node.name !== undefined) {
			name = options.node.name.text;
		}
		return {
			name,
			start,
			end,
			lines: this.class_lines(options.node),
			sloc: this.class_sloc(options.node, options.methods),
			interfaces: options.interfaces,
			base_class_name: this.extends_class_name(options.node),
			methods: options.methods,
		};
	}

	/** Responsibilities: _direct base name resolution_. **/
	private extends_class_name(node: ts.ClassLikeDeclaration): string {
		const clauses = node.heritageClauses;
		if (clauses === undefined) {
			return '';
		}
		for (const clause of clauses) {
if (clause.token !== ts.SyntaxKind.ExtendsKeyword || !clause.types[0]) {
				continue;
			}
			return clause.types[0].expression.getText(this.source_file);
		}
		return '';
	}

	/** Responsibilities: _sum member lines_. **/
	private class_sloc(node: ts.ClassLikeDeclaration, methods: AstCallableNode[]): number {
		const method_sloc_map = new Map<number, number>();
		for (const method of methods) {
			method_sloc_map.set(method.start, method.sloc);
		}
		let total = 1;
		for (const member of node.members) {
			const line = this.source_file.getLineAndCharacterOfPosition(member.getStart(this.source_file)).line;
			total += this.method_sloc_at(method_sloc_map, line);
		}
		return total;
	}

	/** Responsibilities: _retrieve member SLOC_. **/
	private method_sloc_at(methods: ReadonlyMap<number, number>, line: number): number {
		const sloc = methods.get(line);
		if (sloc === undefined) {
			return 1;
		}
		return sloc;
	}

	/** Responsibilities: _member line span calculation_. **/
	private class_lines(node: ts.ClassLikeDeclaration): number {
		return node.members.reduce((total, member) => {
			const first_line = this.source_file.getLineAndCharacterOfPosition(member.getStart(this.source_file)).line;
			const last_line = this.source_file.getLineAndCharacterOfPosition(member.end - 1).line;
			return total + (last_line - first_line) + 1;
		}, 0);
	}

	/** Responsibilities: _class analyzers initialization_. **/
	public constructor(source_file: ts.SourceFile, callable_nodes: CallableNodes) {
		this.source_file = source_file;
		this.callable_nodes = callable_nodes;
		this.member_data = new TypeScriptClassMembers(source_file);
	}

	/** Responsibilities: _class metrics collection_. **/
	public class_nodes(): AstClassNode[] {
		const nodes: AstClassNode[] = [];
		for (const statement of this.source_file.statements) {
			if (ts.isClassDeclaration(statement)) {
				nodes.push(this.class_node(statement));
			}
			if (ts.isVariableStatement(statement)) {
				nodes.push(...this.variable_class_nodes(statement));
			}
		}
		return nodes;
	}

	/** Responsibilities: _interface metrics collection_. **/
	public interface_nodes(): AstClassNode[] {
		const nodes: AstClassNode[] = [];
		for (const statement of this.source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				nodes.push({
					...this.callable_nodes.interface_node({ source_file: this.source_file }, statement),
					fields: this.member_data.interface_fields(statement),
				});
			}
		}
		return nodes;
	}
}
