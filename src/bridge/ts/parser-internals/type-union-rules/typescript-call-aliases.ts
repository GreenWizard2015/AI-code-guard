import ts from 'typescript';
import { TypeScriptBindingAliases } from 'src/typescript-aliases/typescript-binding-aliases';
import { TypeScriptExpressionNames } from 'src/typescript-aliases/typescript-expression-names';

/** Responsibilities: _TypeScript invocation aliases_. **/
export class TypeScriptCallAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly binding_aliases = new TypeScriptBindingAliases();
	private readonly cache = new WeakMap<ts.SourceFile, ReadonlyMap<string, string>>();

	/** Responsibilities: _invocation alias target_. **/
	private append_call(
		aliases: Map<string, string>, name: string, initializer: ts.Expression
	): boolean {
		if (!ts.isCallExpression(initializer)) {
			return false;
		}
		const target = this.call_name(initializer);
		if (target === '') {
			return false;
		}
		aliases.set(name, target);
		return true;
	}

	/** Responsibilities: _referenced invocation alias_. **/
	private append_reference(
		aliases: Map<string, string>, name: string, initializer: ts.Expression
	): boolean {
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		const resolved = aliases.get(initializer.text);
		let target = initializer.text;
		if (resolved !== undefined) {
			target = resolved;
		}
		aliases.set(name, target);
		return true;
	}

	/** Responsibilities: _alias extension_. **/
	private append_alias(
		aliases: Map<string, string>, name: string, initializer: ts.Expression
	): boolean {
		initializer = this.expression_names.unwrap_transparent_expression(initializer);
		if (aliases.has(name)) {
			return false;
		}
		if (this.append_call(aliases, name, initializer)) {
			return true;
		}
		return this.append_reference(aliases, name, initializer);
	}

	/** Responsibilities: _destructured alias collection_. **/
	private append_pattern_alias(aliases: Map<string, string>, node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined || ts.isIdentifier(node.name)) {
			return false;
		}
		return this.binding_aliases.append_binding_aliases(
			new Set<string>(),
			node.name,
			node.initializer,
			expression => this.expression_names.unwrap_transparent_expression(expression),
			(_alias_set, name, initializer) => this.append_alias(aliases, name, initializer)
		);
	}

	/** Responsibilities: _scoped alias collection_. **/
	private append_scope_aliases(aliases: Map<string, string>, node: ts.Node): boolean {
		let changed = false;
		if (ts.isVariableDeclaration(node)) {
			if (ts.isIdentifier(node.name) && node.initializer !== undefined) {
				changed = this.append_alias(aliases, node.name.text, node.initializer);
			}
			if (this.append_pattern_alias(aliases, node)) {
				changed = true;
			}
		}
		node.forEachChild(child => {
			if (this.append_scope_aliases(aliases, child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _invocation alias map_. **/
	public names(source_file: ts.SourceFile): ReadonlyMap<string, string> {
		const cached = this.cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new Map<string, string>();
		let changed = true;
		while (changed) {
			changed = this.append_scope_aliases(aliases, source_file);
		}
		this.cache.set(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _invocation names_. **/
	public call_name(call: ts.CallExpression): string {
		if (ts.isIdentifier(call.expression)) {
			return call.expression.text;
		}
		if (ts.isPropertyAccessExpression(call.expression)) {
			return call.expression.name.text;
		}
		return '';
	}
}
