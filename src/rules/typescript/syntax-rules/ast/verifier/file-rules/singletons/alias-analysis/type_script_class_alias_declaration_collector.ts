import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptArrayDestructuredAliasesContract,
	TypeScriptDestructuredAliasesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptNamespaceAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _class declaration aliases_, _destructured aliases_. **/
export class TypeScriptClassAliasDeclarationCollector {
	private readonly _names: Set<string>;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _namespace_aliases: TypeScriptNamespaceAliasesContract;
	private readonly _destructured_aliases: TypeScriptDestructuredAliasesContract;
	private readonly _array_destructured_aliases: TypeScriptArrayDestructuredAliasesContract;

	/** Responsibilities: _alias target resolution_. **/
	private alias_target(initializer: ts.Expression): string {
		if (ts.isIdentifier(initializer)) {
			return initializer.text;
		}
		return this._namespace_aliases.target(initializer);
	}

	/** Responsibilities: _alias iteration_. **/
	private append_iteration(items: readonly ts.VariableDeclaration[]): boolean {
		let changed = false;
		for (const declaration of items) {
			let alias_added = this.append_alias(declaration);
			if (!alias_added) {
				alias_added = this._destructured_aliases.object_aliases(declaration);
			}
			if (!alias_added) {
				alias_added = this._array_destructured_aliases.array_aliases(declaration);
			}
			if (alias_added) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _alias collection dependencies_. **/
	public constructor(
		names: Set<string>,
		expression_names: ExpressionNamesContract,
		namespace_aliases: TypeScriptNamespaceAliasesContract,
		destructured_aliases: TypeScriptDestructuredAliasesContract,
		array_destructured_aliases: TypeScriptArrayDestructuredAliasesContract,
	) {
		this._names = names;
		this._expression_names = expression_names;
		this._namespace_aliases = namespace_aliases;
		this._destructured_aliases = destructured_aliases;
		this._array_destructured_aliases = array_destructured_aliases;
	}

	/** Responsibilities: _class alias registration_. **/
	public append_alias(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const initializer = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		const target = this.alias_target(initializer);
		if (target.length === 0 || this._names.has(declaration.name.text)) {
			return false;
		}
		if (!ts.isIdentifier(initializer)) {
			this._names.add(target);
		}
		if (!this._names.has(target)) {
			return false;
		}
		this._names.add(declaration.name.text);
		return true;
	}

	/** Responsibilities: _transitive class alias registration_. **/
	public append_aliases(items: readonly ts.VariableDeclaration[]): void {
		this._destructured_aliases.register_sources(items);
		this._array_destructured_aliases.register_sources(items);
		while (this.append_iteration(items)) {
			// Resolve chained aliases until a complete pass adds none.
		}
	}
}
