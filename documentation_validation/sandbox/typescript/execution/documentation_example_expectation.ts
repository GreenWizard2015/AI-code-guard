import checks from "node:assert/strict";
import type {
	DocumentationExampleConsoleSpyContract,
	DocumentationExampleExpectationContract,
} from "documentation_validation/protocols";
import type { CallableDocumentationTestCallback } from "documentation_validation/types";

/** Responsibilities: _value assertion matchers_, _exception assertion matchers_. **/
export class DocumentationExampleExpectation<T> implements DocumentationExampleExpectationContract<T> {
	private readonly _actual: T;

	/** Responsibilities: _assertion subject ownership_. **/
	public constructor(actual: T) {
		this._actual = actual;
	}

	/** Responsibilities: _assertion subject access_. **/
	public actual_value(): T {
		return this._actual;
	}

	/** Responsibilities: _identity comparison_. **/
	public to_be(expected: T): void {
		checks.strictEqual(this._actual, expected, "Documentation test failed: toBe");
	}

	/** Responsibilities: _structural comparison_. **/
	public to_equal(expected: T): void {
		checks.deepStrictEqual(this._actual, expected, "Documentation test failed: toEqual");
	}

	/** Responsibilities: _defined value check_. **/
	public to_be_defined(): void {
		checks.notStrictEqual(this._actual, undefined, "Documentation test failed: toBeDefined");
	}

	/** Responsibilities: _mock call assertion_. **/
	public assert_called(this: DocumentationExampleExpectationContract<DocumentationExampleConsoleSpyContract>): void {
		checks.ok(this.actual_value().called(), "Documentation test failed: toHaveBeenCalled");
	}

	/** Responsibilities: _synchronous exception check_. **/
	public to_throw(
		this: DocumentationExampleExpectationContract<CallableDocumentationTestCallback>,
		expected = "",
	): void {
		checks.throws(this.actual_value(), new RegExp(expected), "Documentation test failed: toThrow");
	}
}
