import type { ObjectLiteralReturnsContract, ContractNameAliasLookupContract } from "src/shared_services_protocols";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import type { TypeScriptContractNameLookupContract } from "src/typescript_runtime_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { ContractNameLookupSet } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/contract_name_lookup_set";
import { ObjectCallableExpression } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_callable_expression";
import ts from "typescript";

/** Responsibilities: _contract results_, _type aliases_. **/
export class ObjectLiteralReturns implements ObjectLiteralReturnsContract {
	private readonly rule: DiagnosticRule;
	private readonly callable_expression: ObjectCallableExpression;
	private readonly project_contract_names: ReadonlySet<string>;
	private readonly project_interface_names: ReadonlySet<string>;
	private readonly project_class_names: ReadonlySet<string>;
	private readonly local_type_aliases: ReadonlySet<string>;
	private readonly function_parent_kinds: Set<ts.SyntaxKind>;

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
		contract_names: TypeScriptContractNameLookupContract,
	): boolean {
		if (contract_names.contains(this.type_name(node.typeName))) {
			return true;
		}
		const type_arguments = node.typeArguments;
		if (type_arguments === undefined) {
			return false;
		}
		return type_arguments.some((type_argument) => this.contains_contract_type(type_argument, contract_names));
	}

	/** Responsibilities: _classification type node references_. **/
	private contains_contract_type(node: ts.TypeNode, contract_names: TypeScriptContractNameLookupContract): boolean {
		if (ts.isTypeReferenceNode(node)) {
			return this.contains_contract_reference(node, contract_names);
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			return node.types.some((type_part) => this.contains_contract_type(type_part, contract_names));
		}
		if (ts.isParenthesizedTypeNode(node)) {
			return this.contains_contract_type(node.type, contract_names);
		}
		return false;
	}

	/** Responsibilities: _collection contract type alias_. **/
	private append_contract_alias(types: ContractNameAliasLookupContract, statement: ts.Statement): boolean {
		if (!ts.isTypeAliasDeclaration(statement) || !ts.isTypeReferenceNode(statement.type)) {
			return false;
		}
		const target = this.type_name(statement.type.typeName);
		if (!types.contains(target)) {
			return false;
		}
		if (types.contains(statement.name.text)) {
			return false;
		}
		types.register_alias(statement.name.text);
		return true;
	}

	/** Responsibilities: _target alias lookup_. **/
	private aliases_for_target(
		aliases_by_target: ReadonlyMap<string, readonly ts.TypeAliasDeclaration[]>,
		target: string,
	): readonly ts.TypeAliasDeclaration[] {
		const aliases = aliases_by_target.get(target);
		if (aliases === undefined) {
			return [];
		}
		return aliases;
	}

	/** Responsibilities: _contract alias grouping_. **/
	private aliases_by_target(aliases: readonly ts.TypeAliasDeclaration[]): Map<string, ts.TypeAliasDeclaration[]> {
		const grouped = new Map<string, ts.TypeAliasDeclaration[]>();
		for (const alias of aliases) {
			if (!ts.isTypeReferenceNode(alias.type)) {
				continue;
			}
			const target = this.type_name(alias.type.typeName);
			const target_aliases = grouped.get(target);
			if (target_aliases === undefined) {
				grouped.set(target, [alias]);
				continue;
			}
			target_aliases.push(alias);
		}
		return grouped;
	}

	/** Responsibilities: _contract alias queue_. **/
	private enqueue_contract_name(name: string, pending: string[], queued: Set<string>): void {
		if (queued.has(name)) {
			return;
		}
		queued.add(name);
		pending.push(name);
	}

	/** Responsibilities: _contract alias queue seeding_. **/
	private seed_contract_aliases(pending: string[], queued: Set<string>): void {
		for (const name of [...this.project_contract_names, ...this.project_interface_names, ...this.project_class_names]) {
			if (!this.local_type_aliases.has(name)) {
				this.enqueue_contract_name(name, pending, queued);
			}
		}
	}

	/** Responsibilities: _contract alias queue processing_. **/
	private process_alias_queue(
		names: ContractNameAliasLookupContract,
		aliases_by_target: ReadonlyMap<string, readonly ts.TypeAliasDeclaration[]>,
		pending: string[],
		queued: Set<string>,
	): void {
		for (let index = 0; index < pending.length; index += 1) {
			const target = pending[index];
			if (target === undefined) {
				continue;
			}
			for (const alias of this.aliases_for_target(aliases_by_target, target)) {
				if (this.append_contract_alias(names, alias)) {
					this.enqueue_contract_name(alias.name.text, pending, queued);
				}
			}
		}
	}

	/** Responsibilities: _contract alias chain_. **/
	private append_alias_chain(
		names: ContractNameAliasLookupContract,
		aliases_by_target: ReadonlyMap<string, readonly ts.TypeAliasDeclaration[]>,
	): void {
		const pending: string[] = [];
		const queued = new Set<string>();
		this.seed_contract_aliases(pending, queued);
		this.process_alias_queue(names, aliases_by_target, pending, queued);
	}

	/** Responsibilities: _resolution contract type aliases_. **/
	private contract_names_for(aliases: readonly ts.TypeAliasDeclaration[]): TypeScriptContractNameLookupContract {
		const names = new ContractNameLookupSet(
			this.project_contract_names,
			this.project_interface_names,
			this.project_class_names,
			this.local_type_aliases,
		);
		if (aliases.length === 0) {
			return names;
		}
		const aliases_by_target = this.aliases_by_target(aliases);
		this.append_alias_chain(names, aliases_by_target);
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
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.ReturnStatement,
		contract_names: TypeScriptContractNameLookupContract,
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
		project_interface_names: ReadonlySet<string>,
		project_class_names: ReadonlySet<string>,
		local_type_aliases: ReadonlySet<string>,
	) {
		this.rule = new DiagnosticRule("typescript-object-literal-return");
		this.callable_expression = new ObjectCallableExpression();
		this.function_parent_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.ArrowFunction,
		]);
		this.project_contract_names = project_contract_names;
		this.project_interface_names = project_interface_names;
		this.project_class_names = project_class_names;
		this.local_type_aliases = local_type_aliases;
	}

	/** Responsibilities: _aggregation object-literal output violations_. **/
	public append_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		index: TypeScriptAstNodeCollection,
	): void {
		const contract_names = this.contract_names_for(index.type_aliases);
		for (const node of index.return_statements) {
			this.append_return_violation(violations, file, source_file, node, contract_names);
		}
	}

	/** Responsibilities: _reporting output statement contains_. **/
	public object_return(node: ts.ReturnStatement, contract_names: TypeScriptContractNameLookupContract): boolean {
		if (!this.fake_object_output(node)) {
			return false;
		}
		const callables = this.containing_function(node);
		const callable = callables[0];
		if (callable?.type === undefined) {
			return false;
		}
		return this.contains_contract_type(callable.type, contract_names);
	}
}
