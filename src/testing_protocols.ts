import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { AstPythonImport, JestSuite, TestTargetImport } from "src/types";
import type ts from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableConsumer } from "src/runtime_types";

/** Responsibilities: _Jest test rule collection_. **/
export interface JestTestRulesContract {
	append_violations(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		resolver: TypeScriptModuleResolverContract,
	): void;
	jest_file(file: string): boolean;
}

/** Responsibilities: _Jest callback extraction_. **/
export interface JestSuiteCollectorContract {
	with_callback(node: ts.CallExpression, consumer: CallableConsumer): void;
	suites(source_file: ts.SourceFile): JestSuite[];
}

/** Responsibilities: _Jest asynchronous completion diagnostics_. **/
export interface JestAsyncCompletionRulesContract {
	append(violations: ViolationContract[], file: string, source_file: ts.SourceFile, tests: ts.CallExpression[]): void;
}

/** Responsibilities: _Jest declaration identity resolution_. **/
export interface JestBindingIndexContract {
	readonly async_declarations: ReadonlySet<ts.Declaration>;
	binding_is(identifier: ts.Identifier, declarations: ReadonlySet<ts.Declaration>): boolean;
}

/** Responsibilities: _Jest setup rule collection_. **/
export interface JestSetupRulesContract {
	append_duplicate_setup(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
	append_fixture_complexity(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void;
}

/** Responsibilities: _Jest test-shape diagnostics contract_. **/
export interface JestTestShapeViolationsContract {
	shape_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
	result_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
	assertion_diagnostics(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
	): void;
}

/** Responsibilities: _Jest test-size contract_. **/
export interface JestTestSizeContract {
	body(source_file: ts.SourceFile, bodies: ts.Block[]): number;
	test_body(body: ts.ConciseBody): number;
	suite(source_file: ts.SourceFile, suite: JestSuite): number;
}

/** Responsibilities: _Jest test-shape rule contract_. **/
export interface JestTestShapeRuleContract {
	non_arrow_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
	missing_expect_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
}

/** Responsibilities: _Jest assertion classification_. **/
export interface JestTestAssertionContract {
	shape_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
	exception_test_lines(source_file: ts.SourceFile, tests: ts.CallExpression[]): number[];
}

/** Responsibilities: _Jest assertion analysis_. **/
export interface JestAssertionAnalysisContract {
	expectation_lines(source_file: ts.SourceFile, tests: ts.CallExpression[], limit: number): number[];
	collect_assertions(node: ts.Node): ts.CallExpression[];
	shape_only(assertions: ts.CallExpression[]): boolean;
	exception_only(assertions: ts.CallExpression[]): boolean;
}

/** Responsibilities: _Jest assertion matcher contract_. **/
export interface JestAssertionMatcherContract {
	shape_assertion(node: ts.CallExpression): boolean;
	exception_assertion(node: ts.CallExpression): boolean;
}

/** Responsibilities: _Jest matcher expression access_. **/
export interface JestMatcherAccessContract {
	receiver_available(expression: ts.Expression): boolean;
	receiver(expression: ts.Expression): ts.Expression;
	member_name(expression: ts.Expression): string;
}

/** Responsibilities: _exception flag binding lookup_. **/
export interface JestExceptionFlagBindingsContract {
	index_declarations(): void;
	exception_flags(callback: ts.ArrowFunction): ReadonlySet<ts.Node>;
	exception_flag(identifier: ts.Identifier, flags: ReadonlySet<ts.Node>): boolean;
}

/** Responsibilities: _test file organization lookup_. **/
export interface TestFileOrganizationContract {
	valid(file: string): boolean;
	source_directory(segments: string[]): boolean;
	module_paths(file: string): string[][];
}

/** Responsibilities: _test path classification_. **/
export interface TestPathCheckerContract {
	directory(path: string): boolean;
	file(path: string): boolean;
}

/** Responsibilities: _test target validation contract_. **/
export interface TestTargetsContract {
	valid(file: string, text: string, python: boolean, python_imports: readonly AstPythonImport[]): boolean;
	valid_typescript(file: string, source_file: ts.SourceFile): boolean;
}

/** Responsibilities: _test target root resolution_. **/
export interface TestTargetRootsContract {
	common_root(file: string, imports: string[], python: boolean, module_path: string[]): string[];
	matches(file: string, imports: string[], python: boolean): boolean;
	matches_target_path(file: string, declaration_path: string): boolean;
}

/** Responsibilities: _project-aware test import resolution_. **/
export interface TestTargetImportResolverContract {
	path(file: string, specifier: string): string;
	declaration_paths(file: string, imports: readonly TestTargetImport[], python: boolean): string[];
}

/** Responsibilities: _test path classification_. **/
export interface TestPathSyntaxContract {
	test_file_name(file: string): boolean;
	test_file(file: string, tests_directory_only: boolean): boolean;
}

/** Responsibilities: _Jest expression matching_. **/
export interface JestExpressionMatchContract {
	value_available(): boolean;
	value(): ts.Expression;
}
