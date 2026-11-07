import { TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_SCANNER_STAGE } from "src/constants";
import { AstModel } from "src/core/ast_model";
import type { TypeScriptScannerInput } from "src/linting/orchestration/runtime/types";
import { TypeScriptScannerProjectNames } from "src/linting/orchestration/runtime/typescript/type_script_scanner_project_names";
import { TypeScriptSourceRuleRuntime } from "src/linting/orchestration/runtime/typescript/type_script_source_rule_runtime";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { FileLinterOptions, TypeScriptScannerOptions } from "src/model_types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectNames } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { AstModelContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptFileScannerContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _TypeScript file analysis_, _ignored file diagnostics_. **/
export class TypeScriptFileScanner implements TypeScriptFileScannerContract {
	private readonly _ast_model: AstModelContract;
	private readonly _project_class_names: ReadonlySet<string>;
	private readonly _typescript_class_names: ReadonlySet<string>;
	private readonly _project_type_names: ReadonlySet<string>;
	private readonly _project_alias_names: ReadonlySet<string>;
	private readonly _project_interface_names: ReadonlySet<string>;
	private readonly _project_contract_names: ReadonlySet<string>;
	private readonly _project_name_inventory: ReadonlySet<string>;
	private readonly _project_boundary_types: ReadonlySet<string>;
	private readonly _project_boundary_contracts: ReadonlySet<string>;
	private readonly _module_resolver: TypeScriptModuleResolverContract;
	private readonly _project_files: ReadonlySet<string>;
	private readonly _project_names: ProjectNames;

	/** Responsibilities: _scanner options_. **/
	private options(input: TypeScriptScannerInput): TypeScriptScannerOptions {
		return {
			source: {
				file_name: input.file_name,
				text: input.text,
				ast_file: input.ast_file,
				traversal: input.traversal,
				stage_timer: input.stage_timer,
			},
			names: {
				project_class_names: this._project_class_names,
				typescript_class_names: this._typescript_class_names,
				project_interface_names: this._project_interface_names,
				project_type_names: this._project_type_names,
				project_alias_names: this._project_alias_names,
				project_contract_names: this._project_contract_names,
				project_boundary_types: this._project_boundary_types,
				project_boundary_contracts: this._project_boundary_contracts,
			},
			project_name_inventory: this._project_name_inventory,
			module_scope: {
				module_resolver: this._module_resolver,
				project_files: this._project_files,
			},
		};
	}

	/** Responsibilities: _project name analysis_, _external class classification_. **/
	private normalized_ast(options: TypeScriptScannerOptions): NormalizedAstFile {
		const stage_timer = options.source.stage_timer;
		const ast_file = options.source.ast_file;
		const ast = stage_timer.measure("file-analysis.typescript.scanner-execution.normalized-ast", () =>
			ast_file.normalized(),
		);
		const project_names = stage_timer.measure("file-analysis.typescript.scanner-execution.project-names", () => {
			const names = new TypeScriptScannerProjectNames(options, ast_file, ast, options.project_name_inventory);
			names.collect();
			return names;
		});
		stage_timer.measure("file-analysis.typescript.scanner-execution.external-base-classification", () =>
			this._ast_model.mark_external_bases(ast.source.classes, project_names),
		);
		return ast;
	}

	/** Responsibilities: _scanner dependencies_. **/
	public constructor(options: FileLinterOptions) {
		const source = options.context.files().find((item) => item.language === TYPESCRIPT_CACHE_OWNER);
		let source_resolver: SourceFileResolver = new Map();
		if (source !== undefined) {
			source_resolver = source.source_resolver;
		}
		const module_context = new TypeScriptModuleExportsContext(
			options.repo_root,
			source_resolver,
			false,
			options.context.source_io(),
		);
		this._module_resolver = module_context.module_exports();
		this._project_files = new Set(options.context.files().map((item) => item.absolute_path));
		this._project_names = options.project_names;
		this._ast_model = new AstModel(TYPESCRIPT_CACHE_OWNER);
		this._project_class_names = options.project_names.typescript_class_names;
		this._typescript_class_names = options.project_names.typescript_class_names;
		this._project_type_names = options.project_names.typescript_type_names;
		this._project_alias_names = options.project_names.typescript_alias_names;
		this._project_interface_names = options.project_names.project_interface_names;
		this._project_contract_names = options.project_names.project_contract_names;
		this._project_name_inventory = new Set([
			...this._typescript_class_names,
			...this._project_type_names,
			...this._project_interface_names,
			...this._project_contract_names,
		]);
		const declared_contract_names = [
			...this._project_type_names,
			...this._project_interface_names,
			...this._project_contract_names,
		];
		const contract_names = declared_contract_names.filter((name) => !this._project_class_names.has(name));
		this._project_boundary_contracts = new Set(contract_names);
		const class_names = [...this._project_class_names];
		const boundary_type_names = class_names.filter((name) => !this._project_boundary_contracts.has(name));
		this._project_boundary_types = new Set(boundary_type_names);
	}

	/** Responsibilities: _TypeScript source preparation_. **/
	public prepare_source(source: LintSourceRecordData, stage_timer: LintStageTimerContract): void {
		const options = this.options({
			file_name: source.file_name,
			text: source.text,
			ast_file: source.typescript_ast,
			traversal: source.traversal,
			stage_timer,
		});
		this.normalized_ast(options);
	}

	/** Responsibilities: _ignored TypeScript file violations_. **/
	public scan_ignored(source: LintSourceRecordData, stage_timer: LintStageTimerContract): ViolationContract[] {
		const options = this.options({
			file_name: source.file_name,
			text: source.text,
			ast_file: source.typescript_ast,
			traversal: source.traversal,
			stage_timer,
		});
		return stage_timer.measure(TYPESCRIPT_SCANNER_STAGE, () => {
			const normalized_ast = this.normalized_ast(options);
			const violations: ViolationContract[] = [];
			const rule_runtime = new TypeScriptSourceRuleRuntime(source, this._project_names, this._module_resolver);
			const context = rule_runtime.context_for_source(violations, normalized_ast, stage_timer);
			rule_runtime.append_source_file(context, stage_timer);
			return violations;
		});
	}
}
