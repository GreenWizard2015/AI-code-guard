import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/io/source_text";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("class state ownership", () => {
	test("counts constructor dependencies used through this destructuring", () => {
		const fixture = new TestFixture();
		const files = {
			"src/registrations.ts": [
				"interface RegistryContract { register(): void; }",
				"class UsedRegistry {",
				"  private readonly registry: RegistryContract;",
				"  public constructor(registry: RegistryContract) { this.registry = registry; }",
				"  public register(): void { const { registry: target } = this; target.register(); }",
				"}",
				"class UnusedRegistry {",
				"  private readonly registry: RegistryContract;",
				"  public constructor(registry: RegistryContract) { this.registry = registry; }",
				"  public register(): void { const { registry: target } = this; }",
				"}",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const stateless_lines = violations
			.filter((item) => item.rule_id() === "stateless-class")
			.map((item) => item.line());

		expect(stateless_lines).toEqual([7]);
	});

	test("distinguishes retained collaborators from readonly data and unused dependencies", () => {
		const fixture = new TestFixture();
		const files = {
			"src/options_injected.ts": [
				"interface TimerContract { measure(): number; }",
				"class OptionsInjected {",
				"  private readonly timer: TimerContract;",
				"  public constructor(options: { timer: TimerContract }) { const supplied = options; this.timer = supplied.timer; }",
				"  public run(): number { return this.timer.measure(); }",
				"}",
			].join("\n"),
			"src/public_dependency.ts": [
				"interface PublicPortContract { read(): string; }",
				"class PublicDependency {",
				"  public readonly port: PublicPortContract;",
				"  public constructor(port: PublicPortContract) { this.port = port; }",
				"}",
			].join("\n"),
			"src/readonly_data.ts": [
				"class ReadonlyData {",
				"  private readonly name: string;",
				"  public constructor(options: { name: string }) { this.name = options.name; }",
				"  public value(): string { return this.name.toUpperCase(); }",
				"}",
			].join("\n"),
			"src/validated_value.ts": [
				"class ValidatedValue {",
				"  private readonly value: string;",
				"  public constructor(value: string) { this.value = value; }",
				"  public valid(): boolean { if (this.value.length === 0) { return false; } return true; }",
				"}",
			].join("\n"),
			"src/cache_miss_context.ts": [
				"class CacheMissContext {",
				"  private readonly source_file: string;",
				"  private readonly reason: string;",
				"  public constructor(source_file: string, reason: string) { this.source_file = source_file; this.reason = reason; }",
				"  public value(): never { throw new Error(`Missing AST cache entry for ${this.source_file}: ${this.reason}`); }",
				"}",
			].join("\n"),
			"src/unused_dependency.ts": [
				"interface PolicyContract { allowed(): boolean; }",
				"class UnusedDependency {",
				"  private readonly policy: PolicyContract;",
				"  public constructor(options: { policy: PolicyContract }) { this.policy = options.policy; }",
				"}",
			].join("\n"),
			"src/owned_collaborator.ts": [
				"class Policy { private enabled = true; public allowed(): boolean { return this.enabled; } }",
				"class OwnedCollaborator {",
				"  private readonly policy: Policy;",
				"  public constructor() { this.policy = new Policy(); }",
				"  public allowed(): boolean { return this.policy.allowed(); }",
				"}",
			].join("\n"),
			"src/hash_identity.ts": [
				"interface HashContract { update(value: string): void; }",
				"declare function createHash(): HashContract;",
				"class HashIdentity {",
				"  private readonly hash: HashContract;",
				"  public constructor() { this.hash = createHash(); }",
				"  public append(value: string): void { this.hash.update(value); }",
				"}",
			].join("\n"),
			"src/readonly_lookup.ts": [
				"class ReadonlyLookup {",
				"  private readonly values: Map<string, string> = new Map();",
				"  public find(key: string): string | undefined { return this.values.get(key); }",
				"}",
			].join("\n"),
			"src/array_lookup.ts": [
				"class ArrayLookup {",
				"  private readonly values: Array<string>;",
				"  public constructor(options: { values: Array<string> }) { this.values = options.values; }",
				"  public first(): string | undefined { return this.values.at(0); }",
				"}",
			].join("\n"),
			"src/readonly_array_lookup.ts": [
				"class ReadonlyArrayLookup {",
				"  private readonly values: ReadonlyArray<string>;",
				"  public constructor(options: { values: ReadonlyArray<string> }) { this.values = options.values; }",
				"  public copy(): string[] { return this.values.slice(); }",
				"}",
			].join("\n"),
			"src/owned_array_initializer.ts": [
				"class OwnedArrayInitializer {",
				"  private readonly values: Array<string> = [];",
				"  public copy(): string[] { return this.values.slice(); }",
				"}",
			].join("\n"),
			"src/nested_state_cell.ts": [
				"type StateCell = { value: number; };",
				"class NestedStateCell {",
				"  private readonly cell: StateCell;",
				"  public constructor() { this.cell = { value: 0 }; }",
				"  public increment(): void { this.cell.value += 1; }",
				"  public value(): number { return this.cell.value; }",
				"}",
			].join("\n"),
			"src/derived_value_state.ts": [
				"declare function normalize_path(path: string): string;",
				"class DerivedValueState {",
				"  private readonly relative_path: string;",
				"  public constructor(root: string, candidate: string) {",
				"    const computed_path = normalize_path(root + candidate);",
				"    this.relative_path = computed_path;",
				"  }",
				"  public inside(): boolean { return this.relative_path.length > 0; }",
				"}",
			].join("\n"),
			"src/reassigned_derived_value_state.ts": [
				"declare function normalize_path(path: string): string;",
				"class ReassignedDerivedValueState {",
				"  private readonly relative_path: string;",
				"  public constructor(root: string, candidate: string) {",
				'    let computed_path = "";',
				"    computed_path = normalize_path(root + candidate);",
				"    this.relative_path = computed_path;",
				"  }",
				"  public inside(): boolean { return this.relative_path.length > 0; }",
				"}",
			].join("\n"),
			"src/derived_collection_snapshot.ts": [
				"interface GroupingContract { grouped(): ReadonlyMap<string, string>; }",
				"declare function create_grouping(values: readonly string[]): GroupingContract;",
				"class DerivedCollectionSnapshot {",
				"  private readonly groups: ReadonlyMap<string, string>;",
				"  public constructor(values: readonly string[]) {",
				"    const grouping = create_grouping(values);",
				"    this.groups = grouping.grouped();",
				"  }",
				"  public size(): number { return this.groups.size; }",
				"}",
			].join("\n"),
			"src/property_name_is_not_input.ts": [
				"interface GroupingContract { grouped(): ReadonlyMap<string, string>; }",
				"declare function create_grouping(): GroupingContract;",
				"class PropertyNameIsNotInput {",
				"  private readonly groups: ReadonlyMap<string, string>;",
				"  private readonly label: string;",
				"  public constructor(grouped: string) {",
				"    const grouping = create_grouping();",
				"    this.groups = grouping.grouped();",
				"    this.label = grouped;",
				"  }",
				"  public size(): number { return this.groups.size; }",
				"  public name(): string { return this.label; }",
				"}",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const stateless_files = violations
			.filter((item) => item.rule_id() === "stateless-class")
			.map((item) => item.file());

		expect({
			options_injected: stateless_files.includes("src/options_injected.ts"),
			public_dependency: stateless_files.includes("src/public_dependency.ts"),
			readonly_data: stateless_files.includes("src/readonly_data.ts"),
			unused_dependency: stateless_files.includes("src/unused_dependency.ts"),
			owned_collaborator: stateless_files.includes("src/owned_collaborator.ts"),
			mutated_hash: stateless_files.includes("src/hash_identity.ts"),
			readonly_lookup: stateless_files.includes("src/readonly_lookup.ts"),
			array_lookup: stateless_files.includes("src/array_lookup.ts"),
			readonly_array_lookup: stateless_files.includes("src/readonly_array_lookup.ts"),
			initializer_array: stateless_files.includes("src/owned_array_initializer.ts"),
			validated_value: stateless_files.includes("src/validated_value.ts"),
			cache_miss_context: stateless_files.includes("src/cache_miss_context.ts"),
			nested_state_cell: stateless_files.includes("src/nested_state_cell.ts"),
			derived_value_state: stateless_files.includes("src/derived_value_state.ts"),
			reassigned_derived_value_state: stateless_files.includes("src/reassigned_derived_value_state.ts"),
			derived_collection_snapshot: stateless_files.includes("src/derived_collection_snapshot.ts"),
			property_name_is_not_input: stateless_files.includes("src/property_name_is_not_input.ts"),
		}).toEqual({
			options_injected: false,
			public_dependency: false,
			readonly_data: true,
			unused_dependency: true,
			owned_collaborator: false,
			mutated_hash: false,
			readonly_lookup: true,
			array_lookup: false,
			readonly_array_lookup: false,
			initializer_array: true,
			validated_value: false,
			cache_miss_context: false,
			nested_state_cell: false,
			derived_value_state: false,
			reassigned_derived_value_state: false,
			derived_collection_snapshot: false,
			property_name_is_not_input: true,
		});
	});
});
