import type { Context } from "node:vm";
import { runInContext } from "node:vm";
import {
	DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
	TYPESCRIPT_DESCRIBE_KEY,
	TYPESCRIPT_EXPECT_KEY,
	TYPESCRIPT_IT_KEY,
	TYPESCRIPT_TEST_CALLBACKS_KEY,
	TYPESCRIPT_TEST_CALLBACK_NAMES_KEY,
	TYPESCRIPT_TEST_CONSOLE_KEY,
	TYPESCRIPT_TEST_JEST_KEY,
	TYPESCRIPT_TEST_KEY,
} from "documentation_validation/constants";
import type {
	DocumentationExampleConsoleContract,
	DocumentationJestRuntimeContract,
	TypeScriptExampleModuleRuntimeContract,
	TypeScriptExampleTestRuntimeContract,
} from "documentation_validation/protocols";
import { DocumentationExampleExpectation } from "documentation_validation/sandbox/typescript/documentation_example_expectation";
import { DocumentationJestRuntime } from "documentation_validation/sandbox/typescript/documentation_jest_runtime";
import type {
	CallableDocumentationBeforeEach,
	CallableDocumentationExpectationFactory,
	CallableDocumentationSuiteRegistration,
	CallableDocumentationTestCallback,
	CallableDocumentationTestRegistration,
	DocumentationTestResult,
} from "documentation_validation/types";
import { JEST_BEFORE_EACH_NAME } from "src/constants";

/** Responsibilities: _Jest API adaptation_, _test registration_, _suite lifecycle_. **/
export class TypeScriptExampleTestRuntime implements TypeScriptExampleTestRuntimeContract {
	private readonly _test_callbacks: CallableDocumentationTestCallback[];
	private readonly _callback_names: Map<CallableDocumentationTestCallback, string>;
	private readonly _suite_names: string[];
	private readonly _before_each_callbacks: CallableDocumentationTestCallback[];
	private readonly _example_console: DocumentationExampleConsoleContract;
	private readonly _jest_runtime: DocumentationJestRuntimeContract;
	private readonly _test_registration: CallableDocumentationTestRegistration;
	private readonly _suite_registration: CallableDocumentationSuiteRegistration;
	private readonly _before_each_registration: CallableDocumentationBeforeEach;
	private readonly _expectation_factory: CallableDocumentationExpectationFactory;

	/** Responsibilities: _test runtime initialization_. **/
	public constructor(example_console: DocumentationExampleConsoleContract) {
		this._test_callbacks = [];
		this._callback_names = new Map<CallableDocumentationTestCallback, string>();
		this._suite_names = [];
		this._before_each_callbacks = [];
		this._example_console = example_console;
		this._jest_runtime = new DocumentationJestRuntime(example_console);
		const register_test: CallableDocumentationTestRegistration = (name, callback) => {
			const setup_callbacks = [...this._before_each_callbacks];
			const suite_name_parts = [...this._suite_names, name];
			const qualified_name = suite_name_parts.join(" ");
			let registered_callback = callback;
			if (setup_callbacks.length > 0) {
				registered_callback = () => {
					for (const setup of setup_callbacks) {
						setup();
					}
					return callback();
				};
			}
			this._test_callbacks.push(registered_callback);
			this._callback_names.set(registered_callback, qualified_name);
		};
		this._test_registration = register_test;
		this._suite_registration = (name, callback) => {
			const setup_start = this._before_each_callbacks.length;
			this._suite_names.push(name);
			try {
				callback();
			} finally {
				this._before_each_callbacks.length = setup_start;
				this._suite_names.pop();
			}
		};
		this._before_each_registration = (callback) => this._before_each_callbacks.push(callback);
		this._expectation_factory = <T>(actual: T) => new DocumentationExampleExpectation(actual);
	}

	/** Responsibilities: _sandbox global installation_. **/
	public install(context: Context): void {
		context[TYPESCRIPT_TEST_CONSOLE_KEY] = this._example_console;
		context[TYPESCRIPT_TEST_CALLBACKS_KEY] = this._test_callbacks;
		context[TYPESCRIPT_TEST_CALLBACK_NAMES_KEY] = this._callback_names;
		context[TYPESCRIPT_TEST_JEST_KEY] = this._jest_runtime;
		context[TYPESCRIPT_TEST_KEY] = this._test_registration;
		context[TYPESCRIPT_IT_KEY] = this._test_registration;
		context[TYPESCRIPT_DESCRIBE_KEY] = this._suite_registration;
		context[JEST_BEFORE_EACH_NAME] = this._before_each_registration;
		context[TYPESCRIPT_EXPECT_KEY] = this._expectation_factory;
	}

	/** Responsibilities: _test registry reset_. **/
	public reset(): void {
		this._test_callbacks.length = 0;
		this._callback_names.clear();
		this._suite_names.length = 0;
		this._before_each_callbacks.length = 0;
		this._jest_runtime.reset();
	}

	/** Responsibilities: _test registry validity_. **/
	public valid_test_registry(): boolean {
		if (this._test_callbacks.length === 0) {
			return this._callback_names.size === 0;
		}
		return this._test_callbacks.length === this._callback_names.size;
	}

	/** Responsibilities: _example test module registration_. **/
	public register_modules(
		test_files: readonly string[],
		module_runtime: TypeScriptExampleModuleRuntimeContract,
	): DocumentationTestResult {
		for (const test_file of test_files) {
			module_runtime.test_module(test_file);
			const execution_error = module_runtime.execution_error(test_file);
			if (execution_error.length > 0) {
				return { done: true, error: execution_error };
			}
		}
		if (test_files.length > 0 && !this.valid_test_registry()) {
			return { done: true, error: "Documentation test files did not register valid test cases." };
		}
		return { done: true, error: "" };
	}

	/** Responsibilities: _test callback execution_. **/
	public run_registered_tests(context: Context): DocumentationTestResult {
		try {
			runInContext(
				`globalThis.__documentation_test_result__ = { done: false, error: '' }; Promise.resolve().then(async () => { for (const callback of ${TYPESCRIPT_TEST_CALLBACKS_KEY}) { try { await callback(); } catch (error) { throw new Error(String(${TYPESCRIPT_TEST_CALLBACK_NAMES_KEY}.get(callback)) + ": " + String(error)); } } }).then(() => { __documentation_test_result__.done = true; }, (error) => { __documentation_test_result__.done = true; __documentation_test_result__.error = String(error); });`,
				context,
				{ filename: "<documentation-tests>", timeout: DOCUMENTATION_EXAMPLE_TIMEOUT_MS },
			);
		} catch (error) {
			return { done: true, error: String(error) };
		}
		return runInContext("__documentation_test_result__", context);
	}
}
