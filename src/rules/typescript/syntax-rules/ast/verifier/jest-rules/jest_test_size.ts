import { MAX_CLASS_LINES } from "src/constants";
import { TypeScriptStatementSloc } from "src/metrics/type_script_statement_sloc";
import type { JestSuite } from "src/model/ast/normalized_ast_types";
import type { JestSuiteCollectorContract, JestTestSizeContract } from "src/testing_protocols";
import type { JestTestCaseCounterContract } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _test size_, _suite size_. **/
export class JestTestSize implements JestTestSizeContract {
	private readonly _statement_sloc: TypeScriptStatementSloc;
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _source_file: ts.SourceFile;
	private readonly _test_case_counter: JestTestCaseCounterContract;

	/** Responsibilities: _test body size calculation_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		suite_collector: JestSuiteCollectorContract,
		test_case_counter: JestTestCaseCounterContract,
	) {
		this._statement_sloc = new TypeScriptStatementSloc();
		this._suite_collector = suite_collector;
		this._source_file = source_file;
		this._test_case_counter = test_case_counter;
	}
	/** Responsibilities: _public operation_. **/
	public body(bodies: ts.Block[]): number {
		for (const body of bodies) {
			const sloc = this._statement_sloc.compound_sloc(body);
			return sloc + (body.statements.length > 0 ? 2 : 0);
		}
		return this._source_file.statements.length;
	}

	/** Responsibilities: _individual Jest callback SLOC_. **/
	public test_body(body: ts.ConciseBody): number {
		if (!ts.isBlock(body)) {
			return 2;
		}
		return 1 + this._statement_sloc.compound_sloc(body);
	}

	/** Responsibilities: _Jest suite size aggregation_. **/
	public suite(suite: JestSuite): number {
		let callbacks = 0;
		for (const test of suite.tests) {
			this._suite_collector.with_callback(test, (callback) => {
				if (callback.body !== undefined && ts.isBlock(callback.body)) {
					callbacks += this.body([callback.body]);
				}
			});
		}
		let setup = 0;
		const suite_body = suite.body.at(0);
		if (suite_body !== undefined) {
			const direct_size = this._statement_sloc.compound_sloc(suite_body);
			if (direct_size > MAX_CLASS_LINES) {
				setup = direct_size;
			}
		}
		const test_count_weight = this._test_case_counter.test_count(suite.tests) * 4;
		return callbacks + setup + test_count_weight;
	}
}
