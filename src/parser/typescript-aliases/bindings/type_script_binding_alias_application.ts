import type { ResolvedStaticBindingQuery } from "src/parser/typescript-aliases/protocols";
import type { BindingAliasesContract } from "src/runtime_protocols";
import type { CallableAliasAppender, CallableExpressionNormalizer } from "src/runtime_types";

/** Responsibilities: _binding alias application state_, _binding alias mutation_. **/
export class TypeScriptBindingAliasApplication {
	private readonly _aliases: Set<string>;
	private readonly _normalize_initializer: CallableExpressionNormalizer;
	private readonly _append_alias: CallableAliasAppender;
	private readonly _binding_aliases: BindingAliasesContract;

	/** Responsibilities: _binding alias application setup_. **/
	public constructor(
		aliases: Set<string>,
		normalize_initializer: CallableExpressionNormalizer,
		append_alias: CallableAliasAppender,
		binding_aliases: BindingAliasesContract,
	) {
		this._aliases = aliases;
		this._normalize_initializer = normalize_initializer;
		this._append_alias = append_alias;
		this._binding_aliases = binding_aliases;
	}

	/** Responsibilities: _single binding alias application_. **/
	public append(target: ResolvedStaticBindingQuery): boolean {
		return this._binding_aliases.append_binding_aliases(
			this._aliases,
			target.binding,
			target.current,
			this._normalize_initializer,
			this._append_alias,
		);
	}

	/** Responsibilities: _object binding alias aggregation_. **/
	public append_all(targets: readonly ResolvedStaticBindingQuery[]): boolean {
		let changed = false;
		for (const target of targets) {
			if (this.append(target)) {
				changed = true;
			}
		}
		return changed;
	}
}
