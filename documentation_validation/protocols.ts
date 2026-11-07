import type { Module } from "node:module";
import type { Context } from "node:vm";
import type {
	DocumentationExampleSourceFiles,
	DocumentationTestResult,
	TypeScriptExampleModuleRequest,
} from "documentation_validation/types";
import type { DocumentationLanguage } from "documentation_validation/types";

/** Responsibilities: _example output lifecycle_. **/
export interface DocumentationExampleOutputContract {
	write(value: string): void;
	calls(): number;
	text(): string;
	exceeded(): boolean;
	reset(): void;
}

/** Responsibilities: _sandbox console API_, _console call observation_. **/
export interface DocumentationExampleConsoleContract {
	log<T>(...values: readonly T[]): void;
	spy(): DocumentationExampleConsoleSpyContract;
}

/** Responsibilities: _console spy observation_, _call count access_. **/
export interface DocumentationExampleConsoleSpyContract {
	call_count(): number;
	called(): boolean;
	called_once(): boolean;
}

/** Responsibilities: _example assertion matchers_, _promise rejection matchers_. **/
export interface DocumentationExampleExpectationContract<T> {
	actual_value(): T;
}

/** Responsibilities: _Jest compatibility boundary_. **/
export interface DocumentationJestRuntimeContract {
	supports(target: DocumentationExampleConsoleContract, method_name: string): boolean;
	reset(): void;
}

/** Responsibilities: _Jest global bindings_, _test case registry_. **/
export interface TypeScriptExampleTestRuntimeContract {
	install(context: Context): void;
	reset(): void;
	valid_test_registry(): boolean;
	register_modules(
		test_files: readonly string[],
		module_runtime: TypeScriptExampleModuleRuntimeContract,
	): DocumentationTestResult;
	run_registered_tests(context: Context): DocumentationTestResult;
}

/** Responsibilities: _virtual example source catalog_. **/
export interface TypeScriptExampleModuleCatalogContract {
	module(request: TypeScriptExampleModuleRequest): string;
	source_text(path: string): string;
}

/** Responsibilities: _example module execution_, _entry source execution_. **/
export interface TypeScriptExampleModuleRuntimeContract {
	module_record(request: TypeScriptExampleModuleRequest): Module;
	test_module(test_path: string): Module;
	entry_module(entry_path: string): Module;
	execution_error(module_path: string): string;
}

/** Responsibilities: _TypeScript module access validation_. **/
export interface TypeScriptModuleImportPolicyContract {
	issues(): readonly string[];
}

/** Responsibilities: _runtime capability validation_. **/
export interface TypeScriptRuntimeCapabilityPolicyContract {
	issues(): readonly string[];
}

/** Responsibilities: _reflection access validation_. **/
export interface TypeScriptReflectionPolicyContract {
	issues(): readonly string[];
}

/** Responsibilities: _example source selection_, _example path metadata_. **/
export interface DocumentationExamplePathContract {
	source_files(): DocumentationExampleSourceFiles;
	source_map(): ReadonlyMap<string, string>;
	language(): DocumentationLanguage;
	source_text(): string;
	entry_file(): string;
	test_files(): readonly string[];
}

/** Responsibilities: _example path layout_. **/
export interface DocumentationExamplePathLayoutContract {
	source_path(): string;
	test_path(): string;
	analysis_path(): string;
}
