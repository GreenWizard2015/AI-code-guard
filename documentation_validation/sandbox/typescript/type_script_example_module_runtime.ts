import { Module } from "node:module";
import { type Context, runInContext } from "node:vm";
import {
	DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
	TYPESCRIPT_CONTEXT_MODULE_KEY,
	TYPESCRIPT_CONTEXT_REQUIRE_KEY,
} from "documentation_validation/constants";
import type {
	TypeScriptExampleModuleCatalogContract,
	TypeScriptExampleModuleRuntimeContract,
} from "documentation_validation/protocols";
import { TypeScriptExampleModuleCompiler } from "documentation_validation/sandbox/typescript/type_script_example_module_compiler";
import type { TypeScriptExampleModuleRequest, TypeScriptExampleModuleSource } from "documentation_validation/types";
import { JEST_DEFINED } from "src/constants";

/** Responsibilities: _virtual module execution_, _module cache ownership_. **/
export class TypeScriptExampleModuleRuntime implements TypeScriptExampleModuleRuntimeContract {
	private readonly _source_files: ReadonlyMap<string, string>;
	private readonly _module_catalog: TypeScriptExampleModuleCatalogContract;
	private readonly _context: Context;
	private readonly _modules_by_file: Map<string, Module>;
	private readonly _execution_errors: Map<string, string>;
	private readonly _compiler: TypeScriptExampleModuleCompiler;

	/** Responsibilities: _VM script execution_. **/
	private execute_context(module: Module, output: string): string {
		let result: unknown;
		try {
			const execution = `(() => { let executionError = ""; try { (function(exports, module) { ${output}\n })(module.exports, module); } catch (error) { executionError = error instanceof Error ? error.name + ": " + error.message : String(error); } return executionError; })()`;
			result = runInContext(execution, this._context, {
				filename: module.id,
				timeout: DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
			});
		} catch (error) {
			const error_message = String(error);
			if (error_message.includes("Script execution timed out")) {
				return error_message;
			}
			throw error;
		}
		if (typeof result === "string") {
			return result;
		}
		return "";
	}

	/** Responsibilities: _module execution_. **/
	private execute_module(module: Module, output: string): string {
		const previous_module = this._context[TYPESCRIPT_CONTEXT_MODULE_KEY];
		this._context[TYPESCRIPT_CONTEXT_MODULE_KEY] = module;
		try {
			return this.execute_context(module, output);
		} finally {
			this._context[TYPESCRIPT_CONTEXT_MODULE_KEY] = previous_module;
		}
	}

	/** Responsibilities: _cached module execution_. **/
	private module_at_path(path: string): Module {
		const existing = this._modules_by_file.get(path);
		if (existing !== undefined) {
			return existing;
		}
		const source_text = this._source_files.get(path);
		if (source_text === undefined) {
			throw new Error(`Module ${path} is outside the example sources.`);
		}
		return this.initialize_module({ module_path: path, source_text });
	}

	/** Responsibilities: _module initialization_, _module execution caching_. **/
	private initialize_module(module_source: TypeScriptExampleModuleSource): Module {
		const source_file = { path: module_source.module_path, text: module_source.source_text };
		const module = new Module(module_source.module_path);
		this._modules_by_file.set(module_source.module_path, module);
		const execution_error = this.execute_module(module, this._compiler.emitted_source(source_file));
		if (execution_error.length > 0) {
			this._execution_errors.set(module_source.module_path, execution_error);
		}
		return module;
	}

	/** Responsibilities: _module runtime initialization_. **/
	public constructor(
		source_files: ReadonlyMap<string, string>,
		module_catalog: TypeScriptExampleModuleCatalogContract,
		context: Context,
	) {
		this._source_files = source_files;
		this._module_catalog = module_catalog;
		this._context = context;
		this._context[TYPESCRIPT_CONTEXT_REQUIRE_KEY] = this;
		this._modules_by_file = new Map<string, Module>();
		this._execution_errors = new Map<string, string>();
		this._compiler = new TypeScriptExampleModuleCompiler(
			new Map([
				["toBe", "to_be"],
				["toEqual", "to_equal"],
				[JEST_DEFINED, "to_be_defined"],
				["toHaveBeenCalled", "assert_called"],
				["toThrow", "to_throw"],
			]),
		);
	}

	/** Responsibilities: _imported module resolution_. **/
	public module_record(request: TypeScriptExampleModuleRequest): Module {
		const path = this._module_catalog.module(request);
		if (path.length === 0) {
			throw new Error(`Module ${request.specifier} is outside the example sources.`);
		}
		const module = this.module_at_path(path);
		const execution_error = this.execution_error(path);
		if (execution_error.length > 0) {
			throw new Error(execution_error);
		}
		return module;
	}

	/** Responsibilities: _test module initialization_, _test module loading_. **/
	public test_module(test_path: string): Module {
		const file_name = test_path.slice(test_path.lastIndexOf("/") + 1);
		const specifier = `./${file_name.replace(/\.tsx?$/u, "")}`;
		return this.module_record({ specifier, parent_path: test_path });
	}

	/** Responsibilities: _entry source execution_. **/
	public entry_module(entry_path: string): Module {
		if (!this._source_files.has(entry_path)) {
			throw new Error(`Module ${entry_path} is outside the example sources.`);
		}
		return this.module_at_path(entry_path);
	}

	/** Responsibilities: _module execution failure_. **/
	public execution_error(module_path: string): string {
		const execution_error = this._execution_errors.get(module_path);
		if (execution_error === undefined) {
			return "";
		}
		return execution_error;
	}
}
