import { TestDataFactory } from "tests/core/test-data-factory";
import type { SharedParameterInputs } from "tests/core/types";

/** Responsibilities: _analyzer fixture provisioning_, _candidate scenario construction_. **/
export class SharedParameterAnalyzerCases {
	private readonly _factory: TestDataFactory;

	/** Responsibilities: _construction callables sharing supplied_. **/
	private callables_with(
		parameters: readonly ReturnType<TestDataFactory["reference_parameter"]>[],
	): ReturnType<TestDataFactory["analyzed_callable"]>[] {
		return Array.from({ length: 4 }, (_, index) =>
			this._factory.analyzed_callable(`full${index + 1}`, index + 1, parameters),
		);
	}

	/** Responsibilities: _shared parameter fixture initialization_. **/
	public constructor() {
		this._factory = new TestDataFactory();
	}

	/** Responsibilities: _construction fixture deterministic node_. **/
	public sorted_nodes(): ReturnType<TestDataFactory["analyzed_callable"]>[] {
		const record = this._factory.reference_parameter("RecordData");
		const repeated = this._factory.analyzed_callable("third", 3, [record, record], "b.ts");
		return [
			this._factory.analyzed_callable("fourth", 4, [record], "b.ts"),
			repeated,
			this._factory.analyzed_callable("second", 2, [record], "a.ts"),
			this._factory.analyzed_callable("first", 1, [record], "a.ts"),
			repeated,
		];
	}

	/** Responsibilities: _construction fixture exact parameter_. **/
	public exact_supports(): SharedParameterInputs {
		const value = this._factory.reference_parameter("clazzA");
		const id = this._factory.primitive_parameter("id", "string");
		const callables = Array.from({ length: 5 }, (_, index) =>
			this._factory.analyzed_callable(`Fa${index + 1}`, index + 1, [value]),
		);
		callables.push(
			...Array.from({ length: 4 }, (_, index) =>
				this._factory.analyzed_callable(`Fb${index + 6}`, index + 6, [value, id]),
			),
		);
		callables.push(
			this._factory.analyzed_callable("Fc10", 10, [value, this._factory.primitive_parameter("x", "string")]),
		);
		callables.push(this._factory.analyzed_callable("Fd11", 11, [value, this._factory.reference_parameter("classX")]));
		return { callables, factory: this._factory };
	}

	/** Responsibilities: _construction fixture arbitrary parameter_. **/
	public arbitrary_combination(): SharedParameterInputs {
		const parameters = [
			this._factory.reference_parameter("ProjectA"),
			this._factory.primitive_parameter("id", "string"),
			this._factory.reference_parameter("ProjectB"),
			this._factory.primitive_parameter("scope", "string"),
		];
		return { callables: this.callables_with(parameters), factory: this._factory };
	}

	/** Responsibilities: _construction fixture five-way parameter_. **/
	public length_five(): SharedParameterInputs {
		const parameters = [
			this._factory.reference_parameter("ProjectA"),
			this._factory.primitive_parameter("id", "string"),
			this._factory.reference_parameter("ProjectB"),
			this._factory.primitive_parameter("scope", "string"),
			this._factory.primitive_parameter("active", "boolean"),
		];
		const callables = Array.from({ length: 4 }, (_, index) => {
			const reversed_parameters = [...parameters];
			reversed_parameters.reverse();
			return this._factory.analyzed_callable(`full${index}`, index + 1, reversed_parameters);
		});
		return { callables, factory: this._factory };
	}

	/** Responsibilities: _construction fixture disjoint shared-parameter_. **/
	public disjoint_pairs(): SharedParameterInputs {
		const project_a = this._factory.reference_parameter("ProjectA");
		const project_b = this._factory.reference_parameter("ProjectB");
		const id = this._factory.primitive_parameter("id", "string");
		const callables = [
			...Array.from({ length: 4 }, (_, index) =>
				this._factory.analyzed_callable(`ab${index}`, index + 1, [project_a, project_b]),
			),
			...Array.from({ length: 4 }, (_, index) =>
				this._factory.analyzed_callable(`ai${index}`, index + 10, [project_a, id]),
			),
			...Array.from({ length: 4 }, (_, index) =>
				this._factory.analyzed_callable(`bi${index}`, index + 20, [project_b, id]),
			),
		];
		return { callables, factory: this._factory };
	}
}
