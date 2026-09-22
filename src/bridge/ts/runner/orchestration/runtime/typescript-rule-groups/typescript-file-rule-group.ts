import { ClassRules } from 'src/bridge/ts/rules/class-rules';
import { ContractFields } from 'src/bridge/ts/rules/contract-fields';
import { MixCollection } from 'src/bridge/ts/core/mix-collection';
import type { Violation } from 'src/protocols';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _coordination TypeScript class contract_. **/
export class TypeScriptFileRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContext;
	private readonly class_rules = new ClassRules();
	private readonly contract_fields = new ContractFields();
	private readonly mix_collection = new MixCollection();

	/** Responsibilities: _collection top-level class indexing_. **/
	private class_indexes(): number[] {
		const class_indexes: number[] = [];
		for (const node of this.context.ast.classes) {
			if (!node.type_contract && !node.protocol) {
				class_indexes.push(node.start);
			}
		}
		return class_indexes;
	}

	/** Responsibilities: _aggregation class structure class_. **/
	private append_class_rules(violations: Violation[]): void {
		const class_indexes = this.class_indexes();
		if (class_indexes.length > 0) {
			this.class_rules.append_typescript_classes(
				violations,
				this.context.file_name.value,
				this.context.lines,
				this.context.ast_file.source_file,
				class_indexes,
			);
		}
	}

	/** Responsibilities: _aggregation contract type-shape violations_. **/
	private append_contract_rules(violations: Violation[]): void {
		this.contract_fields.append_contract_fields(
			violations,
			this.context.file_name.value,
			this.context.ast.classes,
			'interface',
		);
	}

	/** Responsibilities: _aggregation mixin composition violations_. **/
	private append_mix_rules(violations: Violation[]): void {
		this.mix_collection.append_mix_violations(
			violations,
			this.context.ast.classes,
			this.context.ast.functions,
			this.context.file_name,
		);
	}

	/** Responsibilities: _initialization TypeScript source context_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.context = context;
	}

	/** Responsibilities: _aggregation file-level TypeScript rule_. **/
	public append(violations: Violation[]): void {
		this.append_class_rules(violations);
		this.append_contract_rules(violations);
		this.append_mix_rules(violations);
	}
}
