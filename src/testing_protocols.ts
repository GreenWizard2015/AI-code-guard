import type { AstPythonImport, JestSuite, TestTargetImport } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableConsumer } from "src/runtime_types";
import type { LintSourceRecordData } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _Jest test rule collection_. **/
export interface JestTestRulesContract {
	append_violations(violations: ViolationContract[], resolver: TypeScriptModuleResolverContract): void;
}

/** Responsibilities: _Jest callback extraction_. **/
export interface JestSuiteCollectorContract {
	with_callback(node: ts.CallExpression, consumer: CallableConsumer): void;
	suites(source_file: ts.SourceFile): JestSuite[];
}

/** Responsibilities: _Jest test callback traversal state_. **/
export type JestTestCallbackTraversal = {
	readonly active_suites: JestSuite[];
	readonly suites: JestSuite[];
	readonly callback_depth: number;
};

/** Responsibilities: _Jest asynchronous completion diagnostics_. **/
export interface JestAsyncCompletionRulesContract {
	append(violations: ViolationContract[], file: string, source_file: ts.SourceFile, tests: ts.CallExpression[]): void;
}

/** Responsibilities: _Jest async declaration lookup_. **/
export interface JestBindingIndexContract {
	async_call(call: ts.CallExpression): boolean;
	binding_is(identifier: ts.Identifier, declarations: ReadonlySet<ts.Declaration>): boolean;
}

/** Responsibilities: _Jest declaration binding registration_. **/
export type JestDeclarationBindingRegistration = {
	scope: ts.Node;
	candidate: ts.Node;
};

/** Responsibilities: _Jest setup rule collection_. **/
export interface JestSetupRulesContract {
	append_duplicate_setup(tests: ts.CallExpression[]): ViolationContract[];
	fixture_complexity(): ViolationContract[];
}

/** Responsibilities: _Jest test-size contract_. **/
export interface JestTestSizeContract {
	body(bodies: ts.Block[]): number;
	test_body(body: ts.ConciseBody): number;
	suite(suite: JestSuite): number;
}

/** Responsibilities: _Jest case counter contract_. **/
export interface JestTestCaseCounterContract {
	test_count(tests: ts.CallExpression[]): number;
}

/** Responsibilities: _Jest test-shape rule contract_. **/
export interface JestTestShapeRuleContract {
	non_arrow_lines(tests: ts.CallExpression[]): number[];
	missing_expect_lines(tests: ts.CallExpression[]): number[];
}

/** Responsibilities: _Jest assertion classification_. **/
export interface JestTestAssertionContract {
	shape_test_lines(tests: ts.CallExpression[]): number[];
	exception_test_lines(tests: ts.CallExpression[]): number[];
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
	assertion_matches(node: ts.Node, flags: ReadonlySet<ts.Node>): boolean;
}

/** Responsibilities: _test file organization lookup_. **/
export interface TestFileOrganizationContract {
	for_file(file: string): TestFileOrganizationPathContract;
}

/** Responsibilities: _test file organization_, _test module paths_. **/
export interface TestFileOrganizationPathContract {
	valid(): boolean;
	module_paths(): string[][];
}

/** Responsibilities: _test project organization_, _test target resolution_. **/
export type TestTargetProject = {
	readonly organization: TestFileOrganizationContract;
	readonly targets: TestTargetsContract;
};

/** Responsibilities: _test path classification_. **/
export interface TestPathCheckerContract {
	directory(path: string): boolean;
	file(path: string): boolean;
}

/** Responsibilities: _test target validation contract_. **/
export interface TestTargetsContract {
	valid(file: string, text: string, python: boolean, python_imports: readonly AstPythonImport[]): boolean;
	valid_typescript(file: string, source_file: ts.SourceFile): boolean;
	valid_source(source: LintSourceRecordData): boolean;
}

/** Responsibilities: _test-file target match_. **/
export interface TestTargetFileMatchContract {
	matches(): boolean;
}

/** Responsibilities: _test-source production target matching_. **/
export interface TestTargetSourceContract {
	matches_target(resolver: TestTargetImportResolverContract): boolean;
}

/** Responsibilities: _project-aware test import resolution_. **/
export interface TestTargetImportResolverContract {
	path(file: string, specifier: string): string;
	declaration_paths(file: string, imports: readonly TestTargetImport[], python: boolean): string[];
}

/** Responsibilities: _test-file violation collection_. **/
export interface TestFileViolationCollectorContract {
	append(violations: ViolationContract[], source: LintSourceRecordData, file: string, root: string): void;
	append_location(violations: ViolationContract[], source: LintSourceRecordData, file: string): void;
}

/** Responsibilities: _test path classification_. **/
export type TestPathSuffixes = {
	test_file: readonly string[];
	typescript: readonly string[];
	python: readonly string[];
};

/** Responsibilities: _Jest expression matching_. **/
export interface JestExpressionMatchContract {
	value_available(): boolean;
	value(): ts.Expression;
}
