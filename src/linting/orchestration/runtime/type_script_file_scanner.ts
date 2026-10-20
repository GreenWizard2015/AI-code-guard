import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptFileScannerContract } from "src/typescript_analysis_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintFileNameContract, LintSourceRecord } from "src/source_types";
import type { FileLinterOptions, TypeScriptScannerOptions } from "src/model/types/types";
import { TypeScriptScannerAssembly } from "src/linting/orchestration/runtime/type_script_scanner_assembly";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { TYPESCRIPT_SCANNER_STAGE } from "src/linting/orchestration/runtime/constants";

/** Responsibilities: _TypeScript file analysis_, _ignored file diagnostics_. **/
export class TypeScriptFileScanner implements TypeScriptFileScannerContract {
	private readonly assembly: TypeScriptScannerAssembly;
	private readonly project_class_names: ReadonlySet<string>;
	private readonly typescript_class_names: ReadonlySet<string>;
	private readonly project_type_names: ReadonlySet<string>;
	private readonly project_interface_names: ReadonlySet<string>;
	private readonly project_contract_names: ReadonlySet<string>;
	private readonly project_boundary_types: ReadonlySet<string>;
	private readonly project_boundary_contracts: ReadonlySet<string>;
	private readonly module_resolver: TypeScriptModuleResolverContract;
	private readonly project_files: ReadonlySet<string>;

	/** Responsibilities: _scanner options_. **/
	private options(
		file_name: LintFileNameContract,
		text: string,
		ast_file: TypeScriptAstFileContract,
		traversal: TypeScriptAstTraversalContract,
		stage_timer: LintStageTimerContract,
	): TypeScriptScannerOptions {
		return {
			file_name,
			text,
			project_class_names: this.project_class_names,
			typescript_class_names: this.typescript_class_names,
			project_type_names: this.project_type_names,
			project_interface_names: this.project_interface_names,
			project_contract_names: this.project_contract_names,
			project_boundary_types: this.project_boundary_types,
			project_boundary_contracts: this.project_boundary_contracts,
			module_resolver: this.module_resolver,
			project_files: this.project_files,
			ast_file,
			traversal,
			stage_timer,
		};
	}

	/** Responsibilities: _scanner dependencies_. **/
	public constructor(options: FileLinterOptions) {
		const source = options.context.files().find((item) => item.typescript());
		let source_resolver: SourceFileResolver = new Map();
		if (source !== undefined) {
			source_resolver = source.source_resolver;
		}
		this.module_resolver = new TypeScriptModuleExports(
			options.repo_root,
			source_resolver,
			false,
			options.context.source_io,
		);
		this.project_files = new Set(options.context.files().map((item) => item.absolute_path));
		this.assembly = new TypeScriptScannerAssembly();
		this.project_class_names = options.project_names.project_class_names;
		this.typescript_class_names = options.project_names.typescript_class_names;
		this.project_type_names = options.project_names.project_type_names;
		this.project_interface_names = options.project_names.project_interface_names;
		this.project_contract_names = options.project_names.project_contract_names;
		const declared_contract_names = [...this.project_type_names, ...this.project_interface_names, ...this.project_contract_names];
		const contract_names = declared_contract_names.filter((name) => !this.project_class_names.has(name));
		this.project_boundary_contracts = new Set(contract_names);
		const class_names = [...this.project_class_names];
		const boundary_type_names = class_names.filter((name) => !this.project_boundary_contracts.has(name));
		this.project_boundary_types = new Set(boundary_type_names);
	}

	/** Responsibilities: _TypeScript file violations_. **/
	public scan(
		file_name: LintFileNameContract,
		text: string,
		ast_file: TypeScriptAstFileContract,
		traversal: TypeScriptAstTraversalContract,
		stage_timer: LintStageTimerContract,
	): ViolationContract[] {
		const options = this.options(file_name, text, ast_file, traversal, stage_timer);
		return stage_timer.measure(TYPESCRIPT_SCANNER_STAGE, () => {
			return this.assembly.scan(options);
		});
	}

	/** Responsibilities: _ignored TypeScript file violations_. **/
	public scan_ignored(source: LintSourceRecord, stage_timer: LintStageTimerContract): ViolationContract[] {
		const options = this.options(source.file_name, source.text, source.typescript_ast, source.traversal, stage_timer);
		return stage_timer.measure(TYPESCRIPT_SCANNER_STAGE, () => {
			return this.assembly.scan_mixed_module(options);
		});
	}
}
