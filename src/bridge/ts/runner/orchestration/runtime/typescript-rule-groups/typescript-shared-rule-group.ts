import { SharedParameterAdapter } from 'src/metrics/shared-parameter-adapter';
import type { Violation } from 'src/protocols';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _application shared-parameter analysis TypeScript_. **/
export class TypeScriptSharedRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContext;

	/** Responsibilities: _shared-rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.context = context;
	}

	/** Responsibilities: _shared-parameter violations addition_. **/
	public append(violations: Violation[]): void {
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
				kind: 'method',
				nodes: node.methods,
				project_types: this.context.project_type_names,
				reference_aliases: this.context.ast.reference_aliases,
				language: 'typescript',
			});
			violations.push(...adapter.violations());
		}
	}
}
