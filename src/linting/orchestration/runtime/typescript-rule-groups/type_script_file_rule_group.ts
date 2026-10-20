import { ClassRules } from "src/rules/class_rules";
import { ContractFields } from "src/rules/contract_fields";
import { MixCollection } from "src/rules/mix_collection";
import { ContractNames } from "src/rules/contract_names";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import type { TypeScriptRuleGroupContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { MODULE_INTERFACE_KIND } from "src/constants";

/** Responsibilities: _class structure diagnostics_, _contract shape diagnostics_. **/
export class TypeScriptFileRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly class_rules: ClassRules;
	private readonly contract_fields: ContractFields;
	private readonly mix_collection: MixCollection;
	private readonly contract_names: ContractNames;

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
	private append_class_rules(violations: ViolationContract[]): void {
		const class_indexes = this.class_indexes();
		this.class_rules.append_typescript_classes(
			violations,
			this.context.file_name.value,
			this.context.lines,
			this.context.ast_file.source_file_node(),
			class_indexes,
		);
	}

	/** Responsibilities: _aggregation contract type-shape violations_. **/
	private append_contract_rules(violations: ViolationContract[]): void {
		this.contract_fields.append_contract_fields(
			violations,
			this.context.file_name.value,
			this.context.ast.classes,
			MODULE_INTERFACE_KIND,
		);
	}

	/** Responsibilities: _aggregation mixin composition violations_. **/
	private append_mix_rules(violations: ViolationContract[]): void {
		this.mix_collection.append_mix_violations(
			violations,
			this.context.ast.classes,
			this.context.ast.functions,
			this.context.file_name,
		);
	}

	/** Responsibilities: _initialization TypeScript source context_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.class_rules = new ClassRules({
			root: "",
			files: new Set(),
			resolver: new ProjectSourcePython(),
		});
		this.contract_fields = new ContractFields();
		this.mix_collection = new MixCollection();
		this.contract_names = new ContractNames();
		this.context = context;
	}

	/** Responsibilities: _aggregation file-level TypeScript rule_. **/
	public append(violations: ViolationContract[]): void {
		this.contract_names.append(violations, this.context.file_name.value, this.context.ast.classes);
		this.context.stage_timer.measure("file-analysis.typescript.class-structure", () =>
			this.append_class_rules(violations),
		);
		this.append_contract_rules(violations);
		this.append_mix_rules(violations);
	}
}
