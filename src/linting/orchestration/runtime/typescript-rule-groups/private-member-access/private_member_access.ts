import { PrivateAccessAnalysis } from "src/linting/orchestration/runtime/typescript-rule-groups/private-member-access/private_access_analysis";
import { PrivateMemberDeclarationNames } from "src/linting/orchestration/runtime/typescript-rule-groups/private-member-access/private_member_declaration_names";
import { PrivateMemberKeys } from "src/linting/orchestration/runtime/typescript-rule-groups/private-member-access/private_member_keys";
import type { PrivateMemberAccessContract, PrivateMemberDeclarationNamesContract } from "src/analysis_protocols";
import type { PrivateMemberKeysContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _private access analysis_, _rule dependency setup_. **/
export class PrivateMemberAccess implements PrivateMemberAccessContract {
	private readonly member_keys: PrivateMemberKeysContract;
	private readonly declaration_names: PrivateMemberDeclarationNamesContract;

	/** Responsibilities: _private member rule dependencies_. **/
	public constructor() {
		this.member_keys = new PrivateMemberKeys();
		this.declaration_names = new PrivateMemberDeclarationNames();
	}

	/** Responsibilities: _private access analysis_. **/
	public append_private_access(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
	): void {
		const analysis = new PrivateAccessAnalysis(source_file, this.member_keys, this.declaration_names);
		analysis.collect(traversal);
		analysis.append_violations(violations, file);
	}
}
