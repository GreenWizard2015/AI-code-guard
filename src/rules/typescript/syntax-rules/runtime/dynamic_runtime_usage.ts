import ts from "typescript";
import type { RuleContextData } from "src/types";
import { DYNAMIC_RUNTIME_USAGE } from "src/parser/internals/constants";
import { TypeScriptStringBindingNames } from "src/typescript-aliases/type_script_string_binding_names";
import { DynamicRuntimeMembers } from "src/rules/typescript/syntax-rules/runtime/dynamic_runtime_members";
import type { DynamicRuntimeMembersContract, DynamicRuntimeUsageContract } from "src/runtime_protocols";

/** Responsibilities: _dynamic runtime access detection_, _diagnostic candidate reporting_. **/
export class DynamicRuntimeUsage implements DynamicRuntimeUsageContract {
	private readonly string_binding_names: TypeScriptStringBindingNames;
	private readonly member_usage: DynamicRuntimeMembersContract;

	/** Responsibilities: _runtime usage composition_. **/
	public constructor() {
		this.string_binding_names = new TypeScriptStringBindingNames();
		this.member_usage = new DynamicRuntimeMembers();
	}

	/** Responsibilities: _dynamic runtime usage identification_. **/
	public dynamic(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (this.string_binding_names.dynamic_key(node, source_file)) {
			return true;
		}
		return this.member_usage.matches(node);
	}

	/** Responsibilities: _dynamic runtime candidate rules_. **/
	public append_candidate_rule(node: ts.Node, context: RuleContextData): void {
		if (this.dynamic(node, context.source_file)) {
			context.append_rule(node, DYNAMIC_RUNTIME_USAGE);
		}
	}
}
