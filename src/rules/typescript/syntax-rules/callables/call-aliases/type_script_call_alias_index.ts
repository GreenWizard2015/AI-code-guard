import type { BindingAliasesContract, ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptCallAliasCandidate } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _call alias collection_, _alias name resolution_. **/
export class TypeScriptCallAliasIndex {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _binding_aliases: BindingAliasesContract;
	private readonly _aliases: Map<string, string>;

	/** Responsibilities: _call target name resolution_. **/
	private call_target(initializer: ts.CallExpression): string {
		if (ts.isIdentifier(initializer.expression)) {
			return initializer.expression.text;
		}
		if (ts.isPropertyAccessExpression(initializer.expression)) {
			return initializer.expression.name.text;
		}
		return "";
	}

	/** Responsibilities: _call-created alias indexing_. **/
	private append_call_alias(call_alias_candidate: TypeScriptCallAliasCandidate): boolean {
		if (this._aliases.has(call_alias_candidate.name)) {
			return false;
		}
		if (!ts.isCallExpression(call_alias_candidate.initializer)) {
			return false;
		}
		const target = this.call_target(call_alias_candidate.initializer);
		if (target.length === 0) {
			return false;
		}
		this._aliases.set(call_alias_candidate.name, target);
		return true;
	}

	/** Responsibilities: _identifier alias indexing_. **/
	private append_identifier_alias(identifier_alias_candidate: TypeScriptCallAliasCandidate): boolean {
		if (this._aliases.has(identifier_alias_candidate.name)) {
			return false;
		}
		if (!ts.isIdentifier(identifier_alias_candidate.initializer)) {
			return false;
		}
		const alias_target = this._aliases.get(identifier_alias_candidate.initializer.text);
		let target = identifier_alias_candidate.initializer.text;
		if (alias_target !== undefined) {
			target = alias_target;
		}
		this._aliases.set(identifier_alias_candidate.name, target);
		return true;
	}

	/** Responsibilities: _destructured alias collection_. **/
	private append_pattern_alias(node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined || ts.isIdentifier(node.name)) {
			return false;
		}
		return this._binding_aliases.append_binding_aliases(
			new Set<string>(),
			node.name,
			node.initializer,
			(expression) => this._expression_names.unwrap_transparent_expression(expression),
			(name, initializer) => this.append_candidate_alias({ aliases: this._aliases, name, initializer }),
		);
	}

	/** Responsibilities: _candidate alias dispatch_. **/
	private append_candidate_alias(dispatch_candidate: TypeScriptCallAliasCandidate): boolean {
		if (this.append_call_alias(dispatch_candidate)) {
			return true;
		}
		return this.append_identifier_alias(dispatch_candidate);
	}

	/** Responsibilities: _declaration alias collection_. **/
	private append_declaration_alias(node: ts.Node): boolean {
		if (!ts.isVariableDeclaration(node)) {
			return false;
		}
		let changed = false;
		if (ts.isIdentifier(node.name) && node.initializer !== undefined) {
			changed = this.append_candidate_alias({
				aliases: this._aliases,
				name: node.name.text,
				initializer: this._expression_names.unwrap_transparent_expression(node.initializer),
			});
		}
		if (this.append_pattern_alias(node)) {
			return true;
		}
		return changed;
	}

	/** Responsibilities: _scope alias traversal_. **/
	private append_scope_aliases(scope_node: ts.Node): boolean {
		let changed = this.append_declaration_alias(scope_node);
		scope_node.forEachChild((child) => {
			if (this.append_scope_aliases(child)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _source alias storage initialization_. **/
	public constructor(expression_names: ExpressionNamesContract, binding_aliases: BindingAliasesContract) {
		this._expression_names = expression_names;
		this._binding_aliases = binding_aliases;
		this._aliases = new Map<string, string>();
	}

	/** Responsibilities: _alias fixed-point collection_. **/
	public collect(source_file: ts.SourceFile): void {
		let changed = true;
		while (changed) {
			changed = this.append_scope_aliases(source_file);
		}
	}

	/** Responsibilities: _call alias names retrieval_. **/
	public names(): ReadonlyMap<string, string> {
		return this._aliases;
	}
}
