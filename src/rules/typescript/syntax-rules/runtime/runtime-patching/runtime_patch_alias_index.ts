import {
	MOCK_FACTORY_FRAMEWORK_NAMES,
	MOCK_FACTORY_METHOD_NAME,
	PATCH_METHODS,
} from "src/rules/typescript/syntax-rules/runtime/runtime-patching/constants";
import { RuntimePatchFrameworkAliases } from "src/rules/typescript/syntax-rules/runtime/runtime-patching/runtime_patch_framework_aliases";
import type {
	CallableNameSet,
	RuntimePatchAliasIndexContract,
	RuntimePatchExpressionContext,
	RuntimePatchFrameworkAliasIndex,
} from "src/rules/typescript/syntax-rules/runtime/runtime-patching/types";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _patch API identity_, _callable alias resolution_. **/
export class RuntimePatchAliasIndex implements RuntimePatchAliasIndexContract {
	private readonly _source: ts.SourceFile;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
	private readonly _framework_aliases: RuntimePatchFrameworkAliasIndex;
	private readonly _declarations: ts.VariableDeclaration[];
	private readonly _callable_names: CallableNameSet;
	private readonly _patch_alias_names: CallableNameSet;

	/** Responsibilities: _callable declaration registration_. **/
	private add_callable_declaration(declaration_node: ts.Node): void {
		if (ts.isFunctionDeclaration(declaration_node) && declaration_node.name !== undefined) {
			this._callable_names.add(declaration_node.name.text);
		}
		if (!ts.isVariableDeclaration(declaration_node)) {
			return;
		}
		if (declaration_node.initializer === undefined) {
			return;
		}
		if (!ts.isIdentifier(declaration_node.name)) {
			return;
		}
		this._declarations.push(declaration_node);
		const context = { expression: declaration_node.initializer, scope: declaration_node };
		if (this.callable_initializer(context)) {
			this._callable_names.add(declaration_node.name.text);
		}
	}

	/** Responsibilities: _callable initializer classification_. **/
	private callable_initializer(context: RuntimePatchExpressionContext): boolean {
		if (ts.isArrowFunction(context.expression) || ts.isFunctionExpression(context.expression)) {
			return true;
		}
		return this.mock_factory(context);
	}

	/** Responsibilities: _mock factory classification_. **/
	private mock_factory(context: RuntimePatchExpressionContext): boolean {
		const initializer = context.expression;
		if (!ts.isCallExpression(initializer) || !ts.isPropertyAccessExpression(initializer.expression)) {
			return false;
		}
		if (initializer.expression.name.text !== MOCK_FACTORY_METHOD_NAME) {
			return false;
		}
		for (const framework of MOCK_FACTORY_FRAMEWORK_NAMES) {
			const aliases = this._framework_aliases.get(framework);
			if (aliases === undefined) {
				continue;
			}
			if (aliases.expression_matches(initializer.expression.expression, context.scope)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _callable alias propagation_. **/
	private propagate_aliases(names: Set<string>): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of this._declarations) {
				if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
					continue;
				}
				if (!ts.isIdentifier(declaration.initializer)) {
					continue;
				}
				if (!names.has(declaration.initializer.text) || names.has(declaration.name.text)) {
					continue;
				}
				names.add(declaration.name.text);
				changed = true;
			}
		}
	}

	/** Responsibilities: _callable declaration collection_. **/
	private collect_names(): void {
		const visit = (node: ts.Node): void => {
			this.add_callable_declaration(node);
			node.forEachChild(visit);
		};
		visit(this._source);
		this.propagate_aliases(this._callable_names);
	}

	/** Responsibilities: _patch method alias registration_. **/
	private collect_patch_alias(declaration: ts.VariableDeclaration): void {
		const initializer = declaration.initializer;
		if (initializer === undefined || !ts.isIdentifier(declaration.name)) {
			return;
		}
		if (!ts.isPropertyAccessExpression(initializer)) {
			return;
		}
		for (const aliases of this._framework_aliases.values()) {
			const methods = aliases.methods();
			if (!methods.has(initializer.name.text)) {
				continue;
			}
			if (aliases.expression_matches(initializer.expression, declaration)) {
				this._patch_alias_names.add(declaration.name.text);
			}
		}
	}

	/** Responsibilities: _patch method alias collection_. **/
	private collect_patch_aliases(): void {
		for (const declaration of this._declarations) {
			this.collect_patch_alias(declaration);
		}
		this.propagate_aliases(this._patch_alias_names);
	}

	/** Responsibilities: _framework patch aliases_. **/
	private collect_framework_aliases(): void {
		for (const framework of PATCH_METHODS.keys()) {
			this._framework_aliases.set(framework, new RuntimePatchFrameworkAliases(framework, this._declaration_index));
		}
	}

	/** Responsibilities: _patch alias index initialization_. **/
	public constructor(source: ts.SourceFile, declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._source = source;
		this._declaration_index = declaration_index;
		this._declarations = [];
		this._callable_names = new Set<string>();
		this._patch_alias_names = new Set<string>();
		this._framework_aliases = new Map<string, RuntimePatchFrameworkAliases>();
	}

	/** Responsibilities: _source patch alias inventory_. **/
	public collect(): void {
		this.collect_framework_aliases();
		this.collect_names();
		this.collect_patch_aliases();
	}

	/** Responsibilities: _callable replacement resolution_. **/
	public callable_replacement(value: ts.Expression): boolean {
		if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
			return true;
		}
		if (ts.isIdentifier(value)) {
			return this._callable_names.has(value.text);
		}
		return this.mock_factory({ expression: value, scope: value });
	}

	/** Responsibilities: _framework patch call recognition_. **/
	public framework_patch(call: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(call.expression)) {
			if (ts.isIdentifier(call.expression)) {
				return this._patch_alias_names.has(call.expression.text);
			}
			return false;
		}
		for (const aliases of this._framework_aliases.values()) {
			const methods = aliases.methods();
			if (!methods.has(call.expression.name.text)) {
				continue;
			}
			if (aliases.expression_matches(call.expression.expression, call)) {
				return true;
			}
		}
		return false;
	}
}
