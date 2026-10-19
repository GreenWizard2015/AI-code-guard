import { ObjectLiteralReturns } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_literal_returns";
import { TypeScriptAstNodeIndex } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/type_script_ast_node_index";
import type {
	ObjectLiteralReturnsContract,
	TypeScriptScriptRuleServicesContract,
	ViolationContract,
} from "src/protocols";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import type { TypeScriptRuleGroupContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";

/** Responsibilities: _TypeScript declaration rules application_, _application expression Jest rules_. **/
export class TypeScriptScriptRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly object_literal_returns: ObjectLiteralReturnsContract;
	private readonly script_rule_services: TypeScriptScriptRuleServicesContract;
	private readonly ast_node_index: TypeScriptAstNodeIndex;

	/** Responsibilities: _script rule aggregation_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
		this.script_rule_services = context.script_rule_services;
		this.ast_node_index = new TypeScriptAstNodeIndex(context.traversal);
		this.object_literal_returns = new ObjectLiteralReturns(
			context.project_contract_names,
			context.project_interface_names,
			context.project_class_names,
			new Set(context.ast.type_declarations.map((declaration) => declaration.name)),
		);
	}

	/** Responsibilities: _script rule aggregation_. **/
	public append(violations: ViolationContract[]): void {
		const file = this.context.file_name.value;
		const source_file = this.context.ast_file.source_file_node();
		const index = this.ast_node_index.collect();
		this.context.stage_timer.measure("file-analysis.typescript.script-rule.object-literal-returns", () =>
			this.object_literal_returns.append_violations(violations, file, source_file, index),
		);
		this.script_rule_services.append_rules({
			violations,
			file,
			source_file,
			index,
			traversal: this.context.traversal,
			stage_timer: this.context.stage_timer,
			module_resolver: this.context.module_resolver,
		});
	}
}
