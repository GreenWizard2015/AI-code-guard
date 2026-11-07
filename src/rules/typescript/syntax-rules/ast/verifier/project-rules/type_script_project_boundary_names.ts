import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { ProjectTypeBoundaryNames, TypeScriptProjectBoundaryNamesContract } from "src/metrics/types";
import type { AstReferenceAlias } from "src/model/ast/normalized_ast_types";
import { TypeScriptBoundaryAliases } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_boundary_aliases";
import { TypeScriptProjectBoundaryImports } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_imports";
import { TypeScriptProjectBoundaryNameSets } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_name_sets";
import type { RuleContextState } from "src/types";
import type ts from "typescript";

/** Responsibilities: _project boundary type names_, _source reference aliases_. **/
export class TypeScriptProjectBoundaryNames implements TypeScriptProjectBoundaryNamesContract {
	private readonly _names: WeakMap<ts.SourceFile, ProjectTypeBoundaryNames>;
	private readonly _aliases: WeakMap<ts.SourceFile, readonly AstReferenceAlias[]>;
	private readonly _project_names: TypeScriptProjectBoundaryNameSets;

	/** Responsibilities: _source reference aliases_. **/
	private source_aliases(
		alias_state: RuleContextState,
		existing_aliases: readonly AstReferenceAlias[],
	): readonly AstReferenceAlias[] {
		const { source_file } = alias_state.source;
		const cached = this._aliases.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const { module_resolver } = alias_state.analysis;
		const alias_collector = new TypeScriptBoundaryAliases(module_resolver);
		const aliases = alias_collector.collect(source_file, existing_aliases);
		this._aliases.set(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _project boundary names assembly_. **/
	private resolved_names(project_state: RuleContextState): ProjectTypeBoundaryNames {
		const { source_file, normalized_ast } = project_state.source;
		const { project_names } = project_state.project;
		const project_name_sets = this._project_names.names(project_names);
		const { module_resolver } = project_state.analysis;
		const import_collector = new TypeScriptProjectBoundaryImports(module_resolver);
		return {
			project_types: project_names.typescript_type_names,
			...project_name_sets,
			imported_contract_names: import_collector.collect(source_file),
			reference_aliases: this.source_aliases(project_state, normalized_ast.references.reference_aliases),
			language: TYPESCRIPT_LANGUAGE,
		};
	}

	/** Responsibilities: _boundary name cache setup_. **/
	public constructor() {
		this._names = new WeakMap();
		this._aliases = new WeakMap();
		this._project_names = new TypeScriptProjectBoundaryNameSets();
	}

	/** Responsibilities: _project boundary name resolution_. **/
	public names(project_state: RuleContextState): ProjectTypeBoundaryNames {
		const { source_file } = project_state.source;
		const cached = this._names.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const boundary_names = this.resolved_names(project_state);
		this._names.set(source_file, boundary_names);
		return boundary_names;
	}
}
