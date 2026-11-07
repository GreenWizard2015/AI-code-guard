import type { NodeReadonlyStringSetMap } from "src/analysis_types";
import type { ObjectDestructuredAliasesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { ObjectDestructuredAliases } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_destructured_aliases";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { FakeObjectContract } from "src/shared_services_protocols";
import type { ObjectLiteralAliasesContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _object literal alias collection_, _scope-specific lookup_. **/
export class ObjectLiteralAliases implements ObjectLiteralAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _fake_object: FakeObjectContract;
	private readonly _destructured_aliases: ObjectDestructuredAliasesContract;
	private readonly _scope_aliases: NodeReadonlyStringSetMap;

	/** Responsibilities: _fake object alias classification_. **/
	private fake_object_expression(expression: ts.Expression): boolean {
		const current = this._expression_names.unwrap_transparent_expression(expression);
		if (!ts.isObjectLiteralExpression(current)) {
			return false;
		}
		return this._fake_object.fake_object(current);
	}

	/** Responsibilities: _initializer alias propagation_. **/
	private append_initializer_alias(aliases: Set<string>, alias_name: string, initializer: ts.Expression): boolean {
		if (this.fake_object_expression(initializer)) {
			aliases.add(alias_name);
			return true;
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		if (!aliases.has(initializer.text)) {
			return false;
		}
		aliases.add(alias_name);
		return true;
	}

	/** Responsibilities: _object alias extension_. **/
	private append_alias(aliases: Set<string>, node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		if (aliases.has(node.name.text)) {
			return false;
		}
		return this.append_initializer_alias(aliases, node.name.text, node.initializer);
	}

	/** Responsibilities: _scope object aliases_. **/
	private append_scope_aliases(scope_aliases: Set<string>, node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node)) {
			changed = this.append_alias(scope_aliases, node);
		}
		node.forEachChild((child) => {
			if (this.append_scope_aliases(scope_aliases, child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _object alias names collection_. **/
	private collect(scope: ts.Node): ReadonlySet<string> {
		const cached = this._scope_aliases.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Set<string>();
		let changed = true;
		while (changed) {
			changed = this.append_scope_aliases(aliases, scope);
		}
		this._scope_aliases.set(scope, aliases);
		return aliases;
	}

	/** Responsibilities: _object alias resolver initialization_. **/
	public constructor(fake_object: FakeObjectContract) {
		this._expression_names = new TypeScriptExpressionNames();
		this._scope_aliases = new Map<ts.Node, ReadonlySet<string>>();
		this._fake_object = fake_object;
		this._destructured_aliases = new ObjectDestructuredAliases(fake_object);
	}

	/** Responsibilities: _object alias names resolution_. **/
	public names(scope_origin: ts.Node): ReadonlySet<string> {
		let scope = scope_origin;
		while (!ts.isSourceFile(scope) && !ts.isFunctionLike(scope)) {
			scope = scope.parent;
		}
		const names = new Set(this.collect(scope));
		for (const name of this._destructured_aliases.names(scope_origin)) {
			names.add(name);
		}
		return names;
	}

	/** Responsibilities: _object alias classification_. **/
	public contains(identifier: ts.Expression, usage_site: ts.Node): boolean {
		if (!ts.isIdentifier(identifier)) {
			return false;
		}
		return this.names(usage_site).has(identifier.text);
	}
}
