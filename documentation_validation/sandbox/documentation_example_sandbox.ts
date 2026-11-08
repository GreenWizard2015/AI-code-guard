import { createContext } from "node:vm";
import {
	DOCUMENTATION_EXAMPLE_OUTPUT_LIMIT,
	DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
	PYTHON_EXAMPLE_SAFE_MODULES,
	PYTHON_EXAMPLE_SANDBOX,
	PYTHON_FRAME_ATTRIBUTE_NAMES,
	PYTHON_REFLECTIVE_ATTRIBUTE_NAMES,
} from "documentation_validation/constants";
import { DocumentationExamplePath } from "documentation_validation/examples/documentation_example_path";
import type {
	DocumentationExamplePathContract,
	TypeScriptExampleModuleCatalogContract,
	TypeScriptExampleModuleRuntimeContract,
} from "documentation_validation/protocols";
import { DocumentationExampleConsole } from "documentation_validation/sandbox/documentation_example_console";
import { DocumentationExampleOutput } from "documentation_validation/sandbox/documentation_example_output";
import { PythonExamplePolicy } from "documentation_validation/sandbox/python/python_example_policy";
import { PythonSandboxResult } from "documentation_validation/sandbox/python/python_sandbox_result";
import { TypeScriptExampleModuleCatalog } from "documentation_validation/sandbox/typescript/type_script_example_module_catalog";
import { TypeScriptExampleModuleRuntime } from "documentation_validation/sandbox/typescript/type_script_example_module_runtime";
import { TypeScriptExamplePolicy } from "documentation_validation/sandbox/typescript/type_script_example_policy";
import { TypeScriptExampleTestRuntime } from "documentation_validation/sandbox/typescript/type_script_example_test_runtime";
import { DocumentationLanguage } from "documentation_validation/types";
import type {
	CallableDocumentationPythonProcessRunner,
	DocumentationExample,
	DocumentationExampleExecution,
	DocumentationExampleExecutorContract,
	DocumentationPythonProcessRequest,
	DocumentationPythonProcessResult,
} from "documentation_validation/types";

/** Responsibilities: _example execution isolation_, _dangerous capability rejection_. **/
export class DocumentationExampleSandbox implements DocumentationExampleExecutorContract {
	private readonly _source_files: Map<string, string>;
	private readonly _python_runner: CallableDocumentationPythonProcessRunner;
	private readonly _output_capture: DocumentationExampleOutput;
	private readonly _python_policy: PythonExamplePolicy;
	private readonly _typescript_policy: TypeScriptExamplePolicy;
	private readonly _module_catalog: TypeScriptExampleModuleCatalogContract;
	private readonly _test_runtime: TypeScriptExampleTestRuntime;

	/** Responsibilities: _sandbox failure result_. **/
	private failure_execution(message: string): DocumentationExampleExecution {
		const captured_output = this._output_capture.text();
		const output_lines = [captured_output, message];
		const nonempty_lines = output_lines.filter((line) => line.length > 0);
		return { stdout: nonempty_lines.join("\n"), exit_code: 1 };
	}

	/** Responsibilities: _isolated Python process execution_. **/
	private python_process(request: DocumentationPythonProcessRequest): DocumentationPythonProcessResult {
		return this._python_runner("python3", ["-I", "-S", "-c", PYTHON_EXAMPLE_SANDBOX], {
			input: JSON.stringify({
				source_files: Object.fromEntries(this._source_files),
				entry: request.entry,
				safe_modules: [...PYTHON_EXAMPLE_SAFE_MODULES],
				reflective_attributes: [...PYTHON_REFLECTIVE_ATTRIBUTE_NAMES],
				frame_attributes: [...PYTHON_FRAME_ATTRIBUTE_NAMES],
				test_files: request.test_files,
			}),
			encoding: "utf8",
			timeout: DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
			maxBuffer: DOCUMENTATION_EXAMPLE_OUTPUT_LIMIT,
			env: {},
			cwd: "/",
		});
	}

	/** Responsibilities: _test module setup_, _test execution validation_. **/
	private test_execution_failure(
		test_files: readonly string[],
		module_runtime: TypeScriptExampleModuleRuntimeContract,
		context: ReturnType<typeof createContext>,
	): string {
		const registration = this._test_runtime.register_modules(test_files, module_runtime);
		if (registration.error.length > 0) {
			return registration.error;
		}
		const result = this._test_runtime.run_registered_tests(context);
		if (!result.done) {
			return "Documentation tests did not settle inside the sandbox.";
		}
		return result.error;
	}

	/** Responsibilities: _sandboxed TypeScript example execution_. **/
	private run_typescript_example(
		test_files: readonly string[],
		entry: string,
		context: ReturnType<typeof createContext>,
		module_runtime: TypeScriptExampleModuleRuntimeContract,
	): DocumentationExampleExecution {
		const test_error = this.test_execution_failure(test_files, module_runtime, context);
		if (test_error.length > 0) {
			return this.failure_execution(test_error);
		}
		this._output_capture.reset();
		module_runtime.entry_module(entry);
		const execution_error = module_runtime.execution_error(entry);
		if (execution_error.length > 0) {
			return this.failure_execution(execution_error);
		}
		if (this._output_capture.exceeded()) {
			return { stdout: "Documentation example output exceeded the sandbox limit.", exit_code: 1 };
		}
		return { stdout: this._output_capture.text(), exit_code: 0 };
	}

	/** Responsibilities: _TypeScript virtual module execution_. **/
	private execute_typescript(path: DocumentationExamplePathContract): DocumentationExampleExecution {
		const entry = path.entry_file();
		const context = createContext(
			{},
			{
				codeGeneration: { strings: false, wasm: false },
				microtaskMode: "afterEvaluate",
			},
		);
		this._test_runtime.install(context);
		const module_runtime = new TypeScriptExampleModuleRuntime(
			this._source_files,
			this._module_catalog,
			context,
			DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
		);
		const safety_issues = this._typescript_policy.issues();
		if (safety_issues.length > 0) {
			return { stdout: safety_issues.join("\n"), exit_code: 1 };
		}
		return this.run_typescript_example(path.test_files(), entry, context, module_runtime);
	}

	/** Responsibilities: _restricted Python example execution_. **/
	private execute_python(path: DocumentationExamplePathContract): DocumentationExampleExecution {
		const safety_issues = this._python_policy.safety_issues(path);
		if (safety_issues.length > 0) {
			return { stdout: safety_issues.join("\n"), exit_code: 1 };
		}
		const process_request = { entry: path.entry_file(), test_files: path.test_files() };
		const process_result = new PythonSandboxResult(this.python_process(process_request));
		return process_result.execution();
	}

	/** Responsibilities: _sandbox dependency initialization_. **/
	public constructor(python_runner: CallableDocumentationPythonProcessRunner) {
		this._source_files = new Map<string, string>();
		this._python_runner = python_runner;
		this._output_capture = new DocumentationExampleOutput();
		this._python_policy = new PythonExamplePolicy(this._source_files);
		this._module_catalog = new TypeScriptExampleModuleCatalog(this._source_files);
		this._typescript_policy = new TypeScriptExamplePolicy(this._source_files, this._module_catalog);
		const example_console = new DocumentationExampleConsole(this._output_capture);
		this._test_runtime = new TypeScriptExampleTestRuntime(example_console);
	}

	/** Responsibilities: _language-specific sandbox execution_. **/
	public capture_output(example: DocumentationExample): DocumentationExampleExecution {
		const path = new DocumentationExamplePath(example);
		this._output_capture.reset();
		this._test_runtime.reset();
		this._source_files.clear();
		for (const [source_path, source_text] of path.source_map()) {
			this._source_files.set(source_path, source_text);
		}
		if (path.language() === DocumentationLanguage.TYPESCRIPT) {
			return this.execute_typescript(path);
		}
		return this.execute_python(path);
	}
}
