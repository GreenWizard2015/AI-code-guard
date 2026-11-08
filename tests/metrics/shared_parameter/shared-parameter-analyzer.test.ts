import { describe, expect, test } from "@jest/globals";
import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { TestDataFactory } from "tests/core/test-data-factory";

import { SharedParameterAnalyzer } from "src/metrics/shared_parameter/shared_parameter_analyzer";
import { SharedParameterAnalyzerCases } from "tests/metrics/shared_parameter/shared-parameter-analyzer-cases";

describe("SharedParameterAnalyzer", () => {
	const cases = new SharedParameterAnalyzerCases();

	test("builds sorted nodes with unique file-line-method locations", () => {
		const analyzer = new SharedParameterAnalyzer(cases.sorted_nodes());
		const nodes = [...analyzer.shared_parameters().values()];

		expect({ node_count: nodes.length, locations: nodes.map((node) => node.locations) }).toEqual({
			node_count: 1,
			locations: [
				[
					{ file: "a.ts", line: 1, method: "first" },
					{ file: "a.ts", line: 2, method: "second" },
					{ file: "b.ts", line: 3, method: "third" },
					{ file: "b.ts", line: 4, method: "fourth" },
				],
			],
		});
	});

	test("uses argument name and type for distinct primitive nodes", () => {
		const test_data_factory = new TestDataFactory();

		const analyzer = new SharedParameterAnalyzer([
			test_data_factory.analyzed_callable("read", 1, [
				test_data_factory.primitive_parameter("id", "string"),
				test_data_factory.primitive_parameter("name", "string"),
				test_data_factory.primitive_parameter("id", "number"),
			]),
		]);

		const shared_parameters = analyzer.shared_parameters();
		const parameter_nodes = [...shared_parameters.values()];
		const identities = parameter_nodes.map((node) => node.identity);

		expect(identities).toEqual(["id:number", "id:string", "name:string"]);
	});

	test("keeps reference and primitive nodes separate when their labels match", () => {
		const test_data_factory = new TestDataFactory();

		const parameters = [
			test_data_factory.reference_parameter("id:string"),
			test_data_factory.primitive_parameter("id", "string"),
		];
		const analyzer = new SharedParameterAnalyzer(
			Array.from({ length: 4 }, (_, index) =>
				test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters),
			),
		);

		const nodes = [...analyzer.shared_parameters().values()];
		const composites = analyzer.collect_candidates().filter((candidate) => candidate.nodes.length === 2);

		expect(nodes.map((node) => [node.identity, node.kind])).toEqual([
			["id:string", "basic"],
			["value:id:string", "reference"],
		]);
		expect(composites.map((candidate) => candidate.nodes.map((node) => node.kind))).toEqual([["basic", "reference"]]);
	});

	test("includes every annotated type in shared parameter candidates", () => {
		const test_data_factory = new TestDataFactory();
		const project_value = test_data_factory.reference_parameter("ProjectValue");
		const tooling_value = test_data_factory.basic_parameter("source_file", "ts.SourceFile");
		const primitive_value = test_data_factory.primitive_parameter("id", "string");
		const builtin_generic_value = test_data_factory.basic_parameter("records", "Map<string, unknown>");
		const union_value = test_data_factory.basic_parameter("state", "'ready' | 'failed'");
		const callables = Array.from({ length: 4 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, [
				project_value,
				tooling_value,
				primitive_value,
				builtin_generic_value,
				union_value,
			]),
		);
		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();
		const participating_identities = new Set(
			candidates.flatMap((candidate) => candidate.nodes.map((node) => node.identity)),
		);

		expect(participating_identities).toEqual(
			new Set([
				"value:ProjectValue",
				"source_file:ts.SourceFile",
				"id:string",
				"records:Map<string, unknown>",
				"state:'ready' | 'failed'",
			]),
		);
	});

	test("treats equal method names on different lines as distinct locations", () => {
		const test_data_factory = new TestDataFactory();

		const analyzer = new SharedParameterAnalyzer([
			test_data_factory.analyzed_callable(
				"Service.read",
				1,
				[test_data_factory.reference_parameter("RecordData")],
				"service.ts",
				"method",
			),
			test_data_factory.analyzed_callable(
				"Service.read",
				2,
				[test_data_factory.reference_parameter("RecordData")],
				"service.ts",
				"method",
			),
		]);

		const shared_parameters = analyzer.shared_parameters();
		const parameter_nodes = [...shared_parameters.values()];

		expect({ node_count: parameter_nodes.length, locations: parameter_nodes.map((node) => node.locations) }).toEqual({
			node_count: 1,
			locations: [
				[
					{ file: "service.ts", line: 1, method: "Service.read" },
					{ file: "service.ts", line: 2, method: "Service.read" },
				],
			],
		});
	});

	test("builds exact base supports and qualifying candidates", () => {
		const { callables, factory } = cases.exact_supports();
		const analyzer = new SharedParameterAnalyzer(callables);

		const nodes = [...analyzer.shared_parameters().values()];
		const supports = new Map(nodes.map((node) => [node.identity, node.locations.length]));
		const candidates = analyzer.collect_candidates();
		const named_candidates = factory.candidate_named(candidates, "id:string, value:clazzA");

		expect({
			supports,
			candidate_names: candidates.map((item) => factory.candidate_name(item)),
			locations: named_candidates.map((candidate) => candidate.locations.map((item) => item.method)),
		}).toEqual({
			supports: new Map([
				["id:string", 4],
				["value:classX", 1],
				["value:clazzA", 11],
				["x:string", 1],
			]),
			candidate_names: ["id:string", "value:clazzA", "id:string, value:clazzA"],
			locations: [["Fb6", "Fb7", "Fb8", "Fb9"]],
		});
	});

	test("returns reference roots and maximal combinations without expanding every subset", () => {
		const { callables, factory } = cases.arbitrary_combination();
		const analyzer = new SharedParameterAnalyzer(callables);

		const candidates = analyzer.collect_candidates();
		const names = candidates.map((item) => factory.candidate_name(item));
		const unique_names = new Set(names);

		expect({
			count: candidates.length,
			unique_count: unique_names.size,
			full_name: names.includes("id:string, scope:string, value:ProjectA, value:ProjectB"),
			primitive_name: names.includes("id:string"),
			partial_name: names.includes("id:string, scope:string"),
			supports: candidates.every((candidate) => candidate.support === 4),
		}).toEqual({
			count: 5,
			unique_count: 5,
			full_name: true,
			primitive_name: true,
			partial_name: false,
			supports: true,
		});
	});

	test("returns maximal combinations through length five", () => {
		const { callables, factory } = cases.length_five();
		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();
		const matching_candidates = factory.candidate_named(
			candidates,
			"active:boolean, id:string, scope:string, value:ProjectA, value:ProjectB",
		);

		expect({
			count: candidates.length,
			lengths: new Set(candidates.map((candidate) => candidate.nodes.length)),
			support: matching_candidates.map((candidate) => candidate.support),
		}).toEqual({ count: 6, lengths: new Set([1, 5]), support: [4] });
	});

	test("keeps dense parameter groups bounded", () => {
		const test_data_factory = new TestDataFactory();
		const parameters = Array.from({ length: 20 }, (_, index) =>
			test_data_factory.reference_parameter(`Project${index}`),
		);
		const callables = Array.from({ length: 3 }, (_, index) =>
			test_data_factory.analyzed_callable(`dense${index}`, index + 1, parameters),
		);
		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();

		expect({
			count: candidates.length,
			largest: Math.max(...candidates.map((candidate) => candidate.nodes.length)),
		}).toEqual({
			count: 21,
			largest: 20,
		});
	});

	test("does not infer a triple from three disjoint pair groups", () => {
		const { callables, factory } = cases.disjoint_pairs();
		const analyzer = new SharedParameterAnalyzer(callables);

		const names = analyzer.collect_candidates().map((item) => factory.candidate_name(item));

		expect(names).toEqual([
			"id:string",
			"value:ProjectA",
			"value:ProjectB",
			"id:string, value:ProjectA",
			"id:string, value:ProjectB",
			"value:ProjectA, value:ProjectB",
		]);
		expect(names).not.toContain("id:string, value:ProjectA, value:ProjectB");
	});
});
