import type { ASTVerifierRegistryContract } from "src/ast_verifier_protocols";
import type { FileAnalysisCacheContract } from "src/cache_protocols";
import type { LintFileNameContract } from "src/core/support/protocols";
import type { PythonProjectNames } from "src/model_types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type {
	CodingRuleLinterContract,
	FileViolationCollectorContract,
	LintProjectContextContract,
	LintStageTimerContract,
} from "src/shared_services_protocols";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _TypeScript scanner input_. **/
export type TypeScriptScannerInput = {
	file_name: LintFileNameContract;
	text: string;
	ast_file: TypeScriptAstFileContract;
	traversal: TypeScriptAstTraversalContract;
	stage_timer: LintStageTimerContract;
};

export type CodingRuleSourceServices = {
	module_exports: TypeScriptModuleExportsContract;
	source_index: AstPropertySourceIndexContract;
	node_rules: ASTVerifierRegistryContract;
};
export type CachedFileOptions = {
	file: string;
	source: LintSourceRecordData;
	ignored: boolean;
	stage_timer: LintStageTimerContract;
	cache: FileAnalysisCacheContract;
};

export type FileAnalysisOptions = {
	source: LintSourceRecordData;
	ignored: boolean;
	stage_timer: LintStageTimerContract;
	names: PythonProjectNames;
	repo_root: string;
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
};

export type FileLintOptions = {
	file: string;
	repo_root: string;
	stage_timer: LintStageTimerContract;
	names: PythonProjectNames;
	context: LintProjectContextContract;
	ignored_files: ReadonlySet<string>;
	cache: FileAnalysisCacheContract;
	coding_rule_linter: CodingRuleLinterContract;
	violation_collector: FileViolationCollectorContract;
};
