import { MixCollection } from "src/rules/mix_collection";
import type { LintFileNameContract, NormalizedAstFile } from "src/types";
import type { ViolationContract } from "src/protocols";
import type {
	TypeScriptScannerState,
	TypeScriptRuleGroupContract,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";

/** Responsibilities: _TypeScript AST state preparation_, _TypeScript rule groups execution_. **/
export class TypeScriptScannerClass {
	private readonly file_name: LintFileNameContract;
	private readonly ast: NormalizedAstFile;
	private readonly rules: TypeScriptRuleGroupContract;

	public readonly violations: ViolationContract[] = [];

	/** Responsibilities: _scanner state initialization_. **/
	public constructor(state: TypeScriptScannerState) {
		this.file_name = state.file_name;
		this.ast = state.ast;
		this.rules = state.rules;
	}

	/** Responsibilities: _TypeScript rule groups execution_. **/
	public run(): void {
		this.violations.length = 0;
		this.rules.append(this.violations);
	}

	/** Responsibilities: _mixed-module analysis execution_. **/
	public scan_mixed_module(): void {
		this.violations.length = 0;
		const mix_collection = new MixCollection();
		mix_collection.append_mix_violations(this.violations, this.ast.classes, this.ast.functions, this.file_name);
	}

	/** Responsibilities: _scanner result collection_. **/
	public append_results(target: ViolationContract[]): void {
		target.push(...this.violations);
	}
}
