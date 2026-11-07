import { INITIALIZED_REFERENCE_STATE, INITIALIZING_REFERENCE_STATE } from "src/constants";
import type { TypeScriptInstanceAliasCollectorContract } from "src/model/protocols";
import { TypeScriptImportedInstanceAliases } from "src/parser/references/identity/calls/type_script_imported_instance_aliases";
import { TypeScriptInstanceAliasCollector } from "src/parser/references/identity/instances/type_script_instance_alias_collector";
import type {
	TypeScriptReferenceStateInitializationContext,
	TypeScriptReferenceStateInitializationContract,
} from "src/parser/references/identity/references/protocols";
import { TypeScriptReferenceImportState } from "src/parser/references/identity/references/type_script_reference_import_state";
import type { CallableStageOperation } from "src/types";

/** Responsibilities: _lazy TypeScript reference setup_, _setup reentrancy protection_. **/
export class TypeScriptReferenceStateInitializer implements TypeScriptReferenceStateInitializationContract {
	private readonly _context: TypeScriptReferenceStateInitializationContext;
	private readonly _states: Set<string>;
	private readonly _instance_collector: TypeScriptInstanceAliasCollectorContract;

	/** Responsibilities: _optional initialization measurement_. **/
	private measure<T>(name: string, operation: CallableStageOperation<T>): T {
		const { source } = this._context;
		if (source.stage_timer === undefined) {
			return operation();
		}
		return source.stage_timer.measure(
			`startup.project-context.source-records.record-construction.initialize.call-references.${name}`,
			operation,
		);
	}

	/** Responsibilities: _import and alias indexing_. **/
	private initialize_imports(): void {
		const { source, state } = this._context;
		this.measure("imports", () => {
			const imports = new TypeScriptReferenceImportState(
				source.source_file,
				source.project_root,
				source.source_files,
				source.source_io,
			);
			imports.append_function_files(state.function_identities);
			imports.append_local_aliases(state.aliases);
		});
	}

	/** Responsibilities: _imported instance indexing_. **/
	private initialize_imported_instances(): void {
		const { source, state } = this._context;
		this.measure("imported-instances", () => {
			const imported_aliases = new TypeScriptImportedInstanceAliases(
				source.project_root,
				source.source_files,
				source.source_io,
			);
			for (const [name, owner] of imported_aliases.imported_instance_aliases(source.source_file)) {
				state.instances.add(name, owner);
			}
		});
	}

	/** Responsibilities: _reference-state preparation_. **/
	public constructor(context: TypeScriptReferenceStateInitializationContext) {
		this._context = context;
		this._states = new Set<string>();
		this._instance_collector = new TypeScriptInstanceAliasCollector({
			source_file: context.source.source_file,
			traversal: context.source.traversal,
			aliases: context.state.aliases,
			instances: context.state.instances,
			properties: context.state.property_state,
			resolvers: context.state.ownership,
		});
	}

	/** Responsibilities: _lazy reference-state preparation_. **/
	public initialize(): void {
		const { source, state } = this._context;
		if (this._states.has(INITIALIZED_REFERENCE_STATE)) {
			return;
		}
		if (this._states.has(INITIALIZING_REFERENCE_STATE)) {
			return;
		}
		this._states.add(INITIALIZING_REFERENCE_STATE);
		this.initialize_imports();
		this.measure("properties", () => state.property_state.append_tree(source.source_file));
		this.measure("variables-and-parameters", () => this._instance_collector.collect_bindings());
		this.initialize_imported_instances();
		this._states.add(INITIALIZED_REFERENCE_STATE);
	}
}
