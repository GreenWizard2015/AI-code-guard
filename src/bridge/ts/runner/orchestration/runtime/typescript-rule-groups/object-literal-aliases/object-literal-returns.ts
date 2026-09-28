import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { ObjectCallableExpression } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object-callable-expression';
import ts from 'typescript';

/** Responsibilities: _contract output ownership_. **/
export class ObjectLiteralReturns {
	private readonly rule = new DiagnosticRule('typescript-object-literal-return');
	private readonly callable_expression = new ObjectCallableExpression();
	private readonly contract_names: ReadonlySet<string>;
	private readonly function_parent_kinds = new Set([
		ts.SyntaxKind.FunctionDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.FunctionExpression,
		ts.SyntaxKind.ArrowFunction,
	]);

	/** Responsibilities: _resolution textual name output_. **/
	private type_name(node: ts.EntityName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		return node.right.text;
	}

	/** Responsibilities: _classification contract reference_. **/
	private contains_contract_reference(
		node: ts.TypeReferenceNode,
		contract_names: ReadonlySet<string>
	): boolean {
		if (contract_names.has(this.type_name(node.typeName))) {
			return true;
		}
		const type_arguments = node.typeArguments;
		if (type_arguments === undefined) {
			return false;
		}
		return type_arguments.some(type_argument =>
			this.contains_contract_type(type_argument, contract_names)
		);
	}

	/** Responsibilities: _classification type node references_. **/
	private contains_contract_type(node: ts.TypeNode, contract_names: ReadonlySet<string>): boolean {
		if (ts.isTypeReferenceNode(node)) {
			return this.contains_contract_reference(node, contract_names);
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			return node.types.some(type_part => this.contains_contract_type(type_part, contract_names));
		}
		if (ts.isParenthesizedTypeNode(node)) {
			return this.contains_contract_type(node.type, contract_names);
		}
		return false;
	}

	/** Responsibilities: _collection contract type alias_. **/
	private append_contract_alias(types: Set<string>, statement: ts.Statement): boolean {
		if (!ts.isTypeAliasDeclaration(statement) || !ts.isTypeReferenceNode(statement.type)) {
			return false;
		}
		const target = this.type_name(statement.type.typeName);
		if (!types.has(target) || types.has(statement.name.text)) {
			return false;
		}
		types.add(statement.name.text);
		return true;
	}

	/** Responsibilities: _nested alias declaration collection_. **/
	private collect_type_aliases(node: ts.Node, aliases: ts.TypeAliasDeclaration[]): void {
		if (ts.isTypeAliasDeclaration(node)) {
			aliases.push(node);
		}
		node.forEachChild(child => this.collect_type_aliases(child, aliases));
	}

	/** Responsibilities: _source alias declaration collection_. **/
	private type_aliases(source_file: ts.SourceFile): readonly ts.TypeAliasDeclaration[] {
		const aliases: ts.TypeAliasDeclaration[] = [];
		this.collect_type_aliases(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _resolution contract type aliases_. **/
	private contract_names_for(source_file: ts.SourceFile): Set<string> {
		const names = new Set(this.contract_names);
		const aliases = this.type_aliases(source_file);
		let changed = true;
		while (changed) {
			changed = false;
			for (const alias of aliases) {
				if (this.append_contract_alias(names, alias)) {
					changed = true;
				}
			}
		}
		return names;
	}

	/** Responsibilities: _collection enclosing function-like declarations_. **/
	private containing_function(node: ts.Node): ts.SignatureDeclaration[] {
		let parent = node.parent;
		while (parent !== undefined) {
			const function_parent = this.function_parent(parent);
			if (function_parent.length > 0) {
				return function_parent;
			}
			parent = parent.parent;
		}
		return [];
	}

	/** Responsibilities: _resolution nearest function-like parent_. **/
	private function_parent(node: ts.Node): ts.SignatureDeclaration[] {
		if (!this.function_parent_kinds.has(node.kind)) {
			return [];
		}
		if (!ts.isFunctionLike(node)) {
			return [];
		}
		return [node];
	}

	/** Responsibilities: _aggregation diagnostic inline object_. **/
	private append_return_violation(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.ReturnStatement,
		contract_names: ReadonlySet<string>
	): void {
		if (!this.object_return(node, contract_names)) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		violations.push(this.rule.violation(file, line));
	}

	/** Responsibilities: _callable object output classification_. **/
	private fake_object_output(node: ts.ReturnStatement): boolean {
		const expression = node.expression;
		if (expression === undefined) {
			return false;
		}
		return this.callable_expression.matches(expression, node);
	}

	/** Responsibilities: _initialization source context contract_. **/
	public constructor(
		project_contract_names: ReadonlySet<string>,
		local_type_aliases: ReadonlySet<string>
	) {
		this.contract_names = new Set(
			Array.from(project_contract_names).filter(name => !local_type_aliases.has(name))
		);
	}

	/** Responsibilities: _aggregation object-literal output violations_. **/
	public append_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const contract_names = this.contract_names_for(source_file);
		const visit = (node: ts.Node): void => {
			if (ts.isReturnStatement(node)) {
				this.append_return_violation(violations, file, source_file, node, contract_names);
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _reporting output statement contains_. **/
	public object_return(node: ts.ReturnStatement, contract_names: ReadonlySet<string>): boolean {
		if (!this.fake_object_output(node)) {
			return false;
		}
		const callables = this.containing_function(node);
		const callable = callables[0];
		return callable?.type !== undefined && this.contains_contract_type(callable.type, contract_names);
	}

}
