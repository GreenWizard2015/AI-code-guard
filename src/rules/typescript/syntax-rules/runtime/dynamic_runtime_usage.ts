import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { DYNAMIC_RUNTIME_USAGE } from "src/parser/internals/constants";
import { DynamicRuntimeMembers } from "src/rules/typescript/syntax-rules/runtime/dynamic_runtime_members";
import { TypeScriptStringBindingNames } from "src/rules/typescript/syntax-rules/runtime/type_script_string_binding_names";
import type { DynamicRuntimeMembersContract, DynamicRuntimeUsageContract } from "src/runtime_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _dynamic runtime access detection_, _diagnostic candidate reporting_. **/
export class DynamicRuntimeUsage implements DynamicRuntimeUsageContract, ASTSourceRuleContract {
	private readonly _string_binding_names: TypeScriptStringBindingNames;
	private readonly _member_usage: DynamicRuntimeMembersContract;

	/** Responsibilities: _runtime usage composition_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._string_binding_names = new TypeScriptStringBindingNames();
		this._member_usage = new DynamicRuntimeMembers(declaration_index);
	}

	/** Responsibilities: _dynamic runtime usage identification_. **/
	public dynamic(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isElementAccessExpression(node)) {
			if (this._string_binding_names.dynamic_key(node, source_file)) {
				return true;
			}
		}
		return this._member_usage.matches(node);
	}

	/** Responsibilities: _dynamic runtime source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _dynamic runtime candidate rules_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (this.dynamic(request.node, request.context.state().source.source_file)) {
			request.context.for_node(request.node).append_rule(DYNAMIC_RUNTIME_USAGE);
		}
	}
}
