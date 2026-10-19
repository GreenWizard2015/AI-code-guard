import { SharedParameterAdapter } from "src/metrics/shared_parameter_adapter";
import type { ViolationContract } from "src/protocols";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import type { TypeScriptRuleGroupContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import type { SharedParameterTypeSource } from "src/metrics/types";
import { TYPESCRIPT_CACHE_OWNER } from "src/constants";

/** Responsibilities: _shared parameter analysis_, _class method adaptation_. **/
export class TypeScriptSharedRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly type_sources: ReadonlyMap<string, SharedParameterTypeSource>;

	/** Responsibilities: _shared-rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
		this.type_sources = new Map([
			...context.ast.classes.map((item) => [item.name, { file: context.file_name.value, name: item.name }] as const),
			...context.ast.type_declarations.map((item) => [item.name, { file: context.file_name.value, name: item.name }] as const),
		]);
	}

	/** Responsibilities: _shared-parameter violations addition_. **/
	public append(violations: ViolationContract[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		const file = this.context.file_name.value;
		for (const node of this.context.ast.classes) {
			if (node.extends_external_class) {
				continue;
			}
			const adapter = new SharedParameterAdapter({
				file,
				kind: "method",
				nodes: node.methods,
				type_sources: this.type_sources,
				project_types: this.context.project_type_names,
				reference_aliases: this.context.ast.reference_aliases,
				language: TYPESCRIPT_CACHE_OWNER,
			});
			violations.push(...adapter.violations());
		}
	}
}
