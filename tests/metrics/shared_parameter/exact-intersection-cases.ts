import type { AnalyzedParameter } from "src/metrics/types";
import { TestDataFactory } from "tests/core/test-data-factory";

/** Responsibilities: _overlapping parameter construction_, _intersection scenario access_. **/
export class ExactIntersectionCases {
	public readonly _callables: ReturnType<TestDataFactory["analyzed_callable"]>[];

	/** Responsibilities: _intersection fixture callables setup_. **/
	public constructor() {
		const test_data_factory = new TestDataFactory();
		this._callables = Array.from({ length: 10 }, (_, index) => {
			const parameters: AnalyzedParameter[] = [];
			if (index < 8) {
				parameters.push(test_data_factory.reference_parameter("ProjectA"));
			}
			if (index >= 4) {
				parameters.push(test_data_factory.reference_parameter("ProjectB"));
			}
			return test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters);
		});
	}

	/** Responsibilities: _overlapping candidate fixture construction_. **/
	public overlapping_extensions(): ReturnType<TestDataFactory["analyzed_callable"]>[] {
		const test_data_factory = new TestDataFactory();
		const shared_reference = test_data_factory.reference_parameter("Project");
		const x = test_data_factory.primitive_parameter("x", "string");
		const y = test_data_factory.primitive_parameter("y", "string");
		const z = test_data_factory.primitive_parameter("z", "string");
		const parameter_groups = [
			[shared_reference, x, y],
			[shared_reference, x, y, z],
			[shared_reference, x, y, z],
			[shared_reference, x, z],
			[shared_reference, y, z],
		];
		return parameter_groups.map((parameters, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters),
		);
	}
}
