import ts from "typescript";
import { TypeScriptStatementSloc } from "src/metrics/type_script_statement_sloc";
import { JestSuiteCollector } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_suite_collector";
import type { JestSuite } from "src/types";
import { MAX_CLASS_LINES } from "src/constants";
import type { JestTestSizeContract } from "src/testing_protocols";

/** Responsibilities: _test size_, _suite size_. **/
export class JestTestSize implements JestTestSizeContract {
	private readonly statement_sloc: TypeScriptStatementSloc;
	private readonly suite_collector: JestSuiteCollector;

	/** Responsibilities: _test callback size aggregation_. **/
	private callback_size(source_file: ts.SourceFile, suite: JestSuite): number {
		let size = 0;
		for (const test of suite.tests) {
			this.suite_collector.with_callback(test, (callback) => {
				if (callback.body !== undefined) {
					if (ts.isBlock(callback.body)) {
						size += this.body(source_file, [callback.body]);
					}
				}
			});
		}
		return size;
	}

	/** Responsibilities: _oversized direct setup calculation_. **/
	private direct_setup_size(suite: JestSuite): number {
		const suite_body = suite.body.at(0);
		if (suite_body === undefined) {
			return 0;
		}
		const direct_size = this.statement_sloc.compound_sloc(suite_body);
		if (direct_size <= MAX_CLASS_LINES) {
			return 0;
		}
		return direct_size;
	}

	/** Responsibilities: _test body size calculation_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.statement_sloc = new TypeScriptStatementSloc();
		this.suite_collector = new JestSuiteCollector();
	}
	/** Responsibilities: _public operation_. **/
	public body(source_file: ts.SourceFile, bodies: ts.Block[]): number {
		if (bodies.length === 0) {
			return source_file.statements.length;
		}
		const body = bodies[0];
		const sloc = this.statement_sloc.compound_sloc(body);
		return sloc + (body.statements.length > 0 ? 2 : 0);
	}

	/** Responsibilities: _individual Jest callback SLOC_. **/
	public test_body(body: ts.ConciseBody): number {
		if (!ts.isBlock(body)) {
			return 2;
		}
		return 1 + this.statement_sloc.compound_sloc(body);
	}

	/** Responsibilities: _Jest suite size aggregation_. **/
	public suite(source_file: ts.SourceFile, suite: JestSuite): number {
		const callbacks = this.callback_size(source_file, suite);
		const setup = this.direct_setup_size(suite);
		const test_count_weight = suite.tests.length * 4;
		return callbacks + setup + test_count_weight;
	}
}
