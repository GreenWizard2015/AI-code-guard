import { CallableDefinitionUsage } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-definition-usage';
import { CallableOwnership } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-ownership';
import type { Violation } from 'src/protocols';
import type { CallableDefinition } from 'src/metrics/types';
import type { CallableUsageCollectorState } from 'src/bridge/ts/runner/orchestration/runtime/composition/types';
import type { CallableOwnershipResolver } from 'src/types';

/** Responsibilities: _callable usage state conversion_. **/
export class CallableViolationCollector {
	private readonly state: CallableUsageCollectorState;
	private readonly callable_ownership = new CallableOwnership();
	private readonly ownership: CallableOwnershipResolver;

	/** Responsibilities: _construction usage analysis callable_. **/
	private usage_for(definition: CallableDefinition): CallableDefinitionUsage {
		return new CallableDefinitionUsage({
			definition,
			parsed_files: this.state.parsed_files,
			production_files: this.state.production_files,
			definitions: this.state.definitions,
			type_members: this.state.project_types,
			class_nodes: this.state.class_nodes,
			reference_index: this.state.reference_index,
			method_count: this.state.method_counts.count(definition.node.name),
		}, this.ownership);
	}

	/** Responsibilities: _collection violations callable usage_. **/
	private violation_result(usage: CallableDefinitionUsage): Violation[] {
		if (usage.external_method()) {
			return [];
		}
		return usage.collect_violations();
	}

	/** Responsibilities: _initialization callable usage state_. **/
	constructor(state: CallableUsageCollectorState) {
		this.state = state;
		this.ownership = this.callable_ownership.ownership_resolver(
			state.production_files,
			state.project_types,
			state.class_nodes
		);
	}

	/** Responsibilities: _collection unused-callable violations definition_. **/
	public collect_for(definition: CallableDefinition): Violation[] {
		const usage = this.usage_for(definition);
		const violations = this.violation_result(usage);
		if (violations.length === 0) {
			return [];
		}
		return violations;
	}

	/** Responsibilities: _collection unused-callable violations definitions_. **/
	public collect_all(): Violation[] {
		const violations: Violation[] = [];
		for (const definition of this.state.definitions) {
			violations.push(...this.collect_for(definition));
		}
		return violations;
	}
}
