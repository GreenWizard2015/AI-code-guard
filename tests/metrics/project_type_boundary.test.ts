import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { CONTRACT_SUFFIX } from "src/metrics/constants";
import { ProjectTypeBoundary } from "src/metrics/project_type_boundary";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";
import { CONTRACT_BOUNDARY_CALLABLE, PROJECT_BOUNDARY_CALLABLE } from "tests/metrics/constants";

describe("ProjectTypeBoundary", () => {
	test("rejects a default-imported project class at a TypeScript boundary", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"item.ts": "export default class Item { public value = 1; }",
				"consumer.ts": [
					"import LocalItem from './item';",
					"export function read(value: LocalItem): number { return value.value; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((item) => item.file() === "consumer.ts" && item.rule_id() === "project-type-boundary")).toBe(
			true,
		);
	});

	test("keeps a concrete import alias forbidden after an unrelated contract appears", () => {
		const fixture = new TestFixture();
		const files = {
			"item.ts": "export class Item { public value = 1; }",
			"use.ts": [
				"import { Item as Port } from './item';",
				"export function use(value: Port): number { return value.value; }",
				"export function use_many(values: Port[]): number { return values.length; }",
			].join("\n"),
		};
		const without_collision = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const with_collision = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				...files,
				"unrelated.ts": "export interface Port { value: number; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _boundary violation counts_. **/
		const boundary_violations = (violations: readonly ViolationContract[]): number =>
			violations.filter((item) => item.file() === "use.ts" && item.rule_id() === "project-type-boundary").length;

		expect({
			without_collision: boundary_violations(without_collision),
			with_collision: boundary_violations(with_collision),
		}).toEqual({ without_collision: 2, with_collision: 2 });
	});

	test("rejects aliased project classes and allows contract types", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [PROJECT_BOUNDARY_CALLABLE, CONTRACT_BOUNDARY_CALLABLE],
				fields: [],
			},
			names: {
				project_types: new Set(["User", "UserPort"]),
				project_class_names: new Set(["User"]),
				allowed_contracts: new Set([`User${CONTRACT_SUFFIX}`]),
				forbidden_project_types: new Set(["User"]),
				imported_contract_names: new Set(),
				reference_aliases: [{ name: "UserAlias", target: "User" }],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
		expect(violations.map((violation) => violation.rule_id())).toEqual(["project-type-boundary"]);
	});

	test("rejects an aliased project class used only as a parameter", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [
					{
						...PROJECT_BOUNDARY_CALLABLE,
						signature: {
							...PROJECT_BOUNDARY_CALLABLE.signature,
							parameter_types: ["UserAlias"],
							return_type: "number",
							typed_arguments: [{ name: "value", type: "UserAlias", kind: "named" }],
						},
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["User"]),
				project_class_names: new Set(["User"]),
				allowed_contracts: new Set(),
				forbidden_project_types: new Set(["User"]),
				imported_contract_names: new Set(),
				reference_aliases: [{ name: "UserAlias", target: "User" }],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
	});

	test("allows a contract when its name is also in the project type index", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [
					{
						...CONTRACT_BOUNDARY_CALLABLE,
						signature: { ...CONTRACT_BOUNDARY_CALLABLE.signature, return_type: "UserPort" },
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["UserPort"]),
				project_class_names: new Set(),
				allowed_contracts: new Set(["UserPort"]),
				forbidden_project_types: new Set(),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(0);
	});

	test("allows explicitly registered Python contract types in generic parameters", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "snapshots.py",
				callables: [
					{
						...CONTRACT_BOUNDARY_CALLABLE,
						signature: {
							...CONTRACT_BOUNDARY_CALLABLE.signature,
							typed_arguments: [{ name: "snapshots", type: "list[PerformanceSnapshotContract]", kind: "generic" }],
						},
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["PerformanceSnapshotContract"]),
				project_class_names: new Set(),
				allowed_contracts: new Set(["PerformanceSnapshotContract"]),
				forbidden_project_types: new Set(["PerformanceSnapshotContract"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "python",
			},
		});

		boundary.append();

		expect(violations).toEqual([]);
	});

	test("rejects private implementation boundaries", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [
					{
						...PROJECT_BOUNDARY_CALLABLE,
						identity: { ...PROJECT_BOUNDARY_CALLABLE.identity, visibility: "private", owner: "Service" },
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["User"]),
				project_class_names: new Set(["User"]),
				allowed_contracts: new Set(),
				forbidden_project_types: new Set(["User"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
	});

	test("keeps a duplicated class name in the project boundary set", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [
					{
						...PROJECT_BOUNDARY_CALLABLE,
						signature: { ...PROJECT_BOUNDARY_CALLABLE.signature, return_type: "Service" },
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["Service"]),
				project_class_names: new Set(["Service"]),
				allowed_contracts: new Set(),
				forbidden_project_types: new Set(["Service"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
	});

	test("does not let a colliding contract name exempt a concrete class", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [
					{
						...PROJECT_BOUNDARY_CALLABLE,
						signature: { ...PROJECT_BOUNDARY_CALLABLE.signature, return_type: "Item" },
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["Item"]),
				project_class_names: new Set(["Item"]),
				allowed_contracts: new Set(["Item"]),
				forbidden_project_types: new Set(["Item"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
	});

	test("rejects implementation classes in fields for every boundary owner", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "contracts.ts",
				callables: [],
				fields: [
					{
						line: 4,
						name: "user",
						value_name: "",
						type: "User",
						type_kind: "named",
						readonly: false,
						class_variable: false,
						class_scope: false,
						visibility: "public",
					},
					{
						line: 5,
						name: "port",
						value_name: "",
						type: "UserPort",
						type_kind: "named",
						readonly: false,
						class_variable: false,
						class_scope: false,
						visibility: "public",
					},
				],
			},
			names: {
				project_types: new Set(["User", "UserPort"]),
				project_class_names: new Set(["User"]),
				allowed_contracts: new Set(["UserPort"]),
				forbidden_project_types: new Set(["User"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "python",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
		expect(violations.map((violation) => violation.line())).toEqual([4]);
	});

	test("rejects a TypeScript implementation inside a contract generic", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.ts",
				callables: [
					{
						...CONTRACT_BOUNDARY_CALLABLE,
						signature: { ...CONTRACT_BOUNDARY_CALLABLE.signature, return_type: "Map<UserPort, User>" },
					},
				],
				fields: [],
			},
			names: {
				project_types: new Set(["User", "UserPort"]),
				project_class_names: new Set(["User"]),
				allowed_contracts: new Set(["UserPort"]),
				forbidden_project_types: new Set(["User"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "typescript",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
	});

	test("rejects a Python implementation inside a contract generic", () => {
		const violations: ViolationContract[] = [];
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: "service.py",
				callables: [],
				fields: [
					{
						line: 4,
						name: "users",
						value_name: "",
						type: "dict[UserPort, User]",
						type_kind: "generic",
						readonly: false,
						class_variable: false,
						class_scope: false,
						visibility: "public",
					},
				],
			},
			names: {
				project_types: new Set(["User", "UserPort"]),
				project_class_names: new Set(["User"]),
				allowed_contracts: new Set(["UserPort"]),
				forbidden_project_types: new Set(["User"]),
				imported_contract_names: new Set(),
				reference_aliases: [],
				language: "python",
			},
		});

		boundary.append();

		expect(violations).toHaveLength(1);
	});
});
