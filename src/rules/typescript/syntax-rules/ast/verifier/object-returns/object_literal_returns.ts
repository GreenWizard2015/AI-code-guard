import { ExternalImportedTypes } from "src/linting/test-support/external_imported_types";
import { FakeObject } from "src/linting/test-support/fake_object";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { ObjectCallableAliases } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_callable_aliases";
import { ObjectCallableExpression } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_callable_expression";
import { ObjectLiteralAliases } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_literal_aliases";
import { ObjectLiteralTypeAliasChain } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_literal_type_alias_chain";
import { ObjectLiteralTypeNameLookupSet } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_literal_type_name_lookup_set";
import { ObjectLiteralTypeReferenceChecker } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_literal_type_reference_checker";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { ObjectLiteralReturnsContract, ObjectLiteralTypeNameLookupContract } from "src/shared_services_protocols";
import type {
	FakeObjectContract,
	ObjectCallableAliasesContract,
	ObjectLiteralAliasesContract,
} from "src/shared_services_protocols";
import type { TypeScriptTypeNameLookupContract } from "src/typescript_runtime_protocols";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import ts from "typescript";

/** Responsibilities: _contract results_, _type aliases_. **/
export class ObjectLiteralReturns implements ObjectLiteralReturnsContract {
	private readonly _rule: RuleContract;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _fake_object: FakeObjectContract;
	private readonly _object_aliases: ObjectLiteralAliasesContract;
	private readonly _callable_aliases: ObjectCallableAliasesContract;
	private readonly _project_contract_names: ReadonlySet<string>;
	private readonly _project_interface_names: ReadonlySet<string>;
	private readonly _project_class_names: ReadonlySet<string>;
	private readonly _local_type_aliases: ReadonlySet<string>;
	private readonly _function_parent_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _resolution textual name output_. **/
	private type_name(node: ts.EntityName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		return node.right.text;
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

	/** Responsibilities: _contract alias chain_. **/
	private append_alias_chain(
		names: ObjectLiteralTypeNameLookupContract,
		aliases_by_target: ReadonlyMap<string, readonly ts.TypeAliasDeclaration[]>,
	): void {
		const contract_sources = [
			...this._project_contract_names,
			...this._project_interface_names,
			...this._project_class_names,
		];
		const seeds = contract_sources.filter((name) => !this._local_type_aliases.has(name));
		const chain = new ObjectLiteralTypeAliasChain(names, aliases_by_target);
		chain.append(seeds);
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
		if (!this._function_parent_kinds.has(node.kind)) {
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
		contract_names: TypeScriptTypeNameLookupContract,
	): void {
		if (!this.object_return(node, contract_names)) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		violations.push(this._rule.violation(file, line, {}));
	}

	/** Responsibilities: _initialization source context contract_. **/
	public constructor(
		project_contract_names: ReadonlySet<string>,
		project_interface_names: ReadonlySet<string>,
		project_class_names: ReadonlySet<string>,
		local_type_aliases: ReadonlySet<string>,
	) {
		this._rule = new DiagnosticRule("typescript-object-literal-return");
		this._expression_names = new TypeScriptExpressionNames();
		this._fake_object = new FakeObject(new ExternalImportedTypes());
		this._object_aliases = new ObjectLiteralAliases(this._fake_object);
		this._callable_aliases = new ObjectCallableAliases(this._fake_object);
		this._function_parent_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.ArrowFunction,
		]);
		this._project_contract_names = project_contract_names;
		this._project_interface_names = project_interface_names;
		this._project_class_names = project_class_names;
		this._local_type_aliases = local_type_aliases;
	}

	/** Responsibilities: _resolution contract type aliases_. **/
	public contract_names_for(aliases: readonly ts.TypeAliasDeclaration[]): TypeScriptTypeNameLookupContract {
		const names = new ObjectLiteralTypeNameLookupSet(
			this._project_contract_names,
			this._project_interface_names,
			this._project_class_names,
			this._local_type_aliases,
		);
		if (aliases.length === 0) {
			return names;
		}
		const aliases_by_target = this.aliases_by_target(aliases);
		this.append_alias_chain(names, aliases_by_target);
		return names;
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
	public object_return(node: ts.ReturnStatement, contract_names: TypeScriptTypeNameLookupContract): boolean {
		const output = new ObjectCallableExpression(
			this._expression_names,
			this._fake_object,
			this._object_aliases,
			this._callable_aliases,
			node,
		);
		if (!output.matches_return()) {
			return false;
		}
		const callables = this.containing_function(node);
		const callable = callables[0];
		if (callable === undefined || callable.type === undefined) {
			return false;
		}
		const checker = new ObjectLiteralTypeReferenceChecker(contract_names);
		return checker.contains(callable.type);
	}
}
