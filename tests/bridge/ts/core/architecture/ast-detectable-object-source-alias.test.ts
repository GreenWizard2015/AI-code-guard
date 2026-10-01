import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("AST-detectable object source aliases", () => {
	test("detects destructured Object.assign aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-alias.ts": [
				"const object_alias = Object;",
				"const second_alias = object_alias;",
				"const { assign: object_assign } = second_alias;",
				'const alias_assign_source = object_assign({ alias_assign_key: "alias_assign_run" }, {});',
				"const { alias_assign_key } = alias_assign_source;",
				"class AliasAssignObjectCallables { [alias_assign_key](): void {} }",
				"const { alias_assign_run } = new AliasAssignObjectCallables();",
				"const alias_assign_object_service = { alias_assign_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects transitive destructured Object.assign aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-transitive.ts": [
				"const { assign } = Object;",
				"const object_assign = assign;",
				'const source = object_assign({ transitive_key: "transitive_run" }, {});',
				"const { transitive_key } = source;",
				"class TransitiveAssignObjectCallables { [transitive_key](): void {} }",
				"const { transitive_run } = new TransitiveAssignObjectCallables();",
				"const transitive_service = { transitive_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects computed Object.assign calls", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-computed.ts": [
				'const source = Object["assign"]({ computed_key: "computed_run" }, {});',
				"const { computed_key } = source;",
				"class ComputedAssignObjectCallables { [computed_key](): void {} }",
				"const { computed_run } = new ComputedAssignObjectCallables();",
				"const computed_service = { computed_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-key-alias.ts": [
				'const assign_key = "assign";',
				'const source = Object[assign_key]({ alias_key: "alias_run" }, {});',
				"const { alias_key } = source;",
				"class AliasAssignObjectCallables { [alias_key](): void {} }",
				"const { alias_run } = new AliasAssignObjectCallables();",
				"const alias_service = { alias_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects nested array computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-nested-array.ts": [
				'const [[assign_key]] = [["assign"]];',
				'const source = Object[assign_key]({ nested_key: "nested_run" }, {});',
				"const { nested_key } = source;",
				"class NestedAssignObjectCallables { [nested_key](): void {} }",
				"const { nested_run } = new NestedAssignObjectCallables();",
				"const nested_service = { nested_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects array-rest computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-array-rest.ts": [
				'const [...assign_keys] = ["assign"];',
				"const [assign_key] = assign_keys;",
				'const source = Object[assign_key]({ rest_key: "rest_run" }, {});',
				"const { rest_key } = source;",
				"class RestAssignObjectCallables { [rest_key](): void {} }",
				"const { rest_run } = new RestAssignObjectCallables();",
				"const rest_service = { rest_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects array-spread computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-array-spread.ts": [
				'const spread_keys = [...["assign"]];',
				"const [assign_key] = spread_keys;",
				'const source = Object[assign_key]({ spread_key: "spread_run" }, {});',
				"const { spread_key } = source;",
				"class SpreadAssignObjectCallables { [spread_key](): void {} }",
				"const { spread_run } = new SpreadAssignObjectCallables();",
				"const spread_service = { spread_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects conditional array computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-conditional-array.ts": [
				"declare const use_first: boolean;",
				'const assign_keys = use_first ? ["assign"] : ["assign"];',
				"const [assign_key] = assign_keys;",
				'const source = Object[assign_key]({ conditional_key: "conditional_run" }, {});',
				"const { conditional_key } = source;",
				"class ConditionalAssignObjectCallables { [conditional_key](): void {} }",
				"const { conditional_run } = new ConditionalAssignObjectCallables();",
				"const conditional_service = { conditional_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects assigned array computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-array-assignment.ts": [
				"let assign_keys: string[] = [];",
				'assign_keys = ["assign"];',
				"const [assign_key] = assign_keys;",
				'const source = Object[assign_key]({ assigned_key: "assigned_run" }, {});',
				"const { assigned_key } = source;",
				"class AssignedAssignObjectCallables { [assigned_key](): void {} }",
				"const { assigned_run } = new AssignedAssignObjectCallables();",
				"const assigned_service = { assigned_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects concatenated array computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-array-concat.ts": [
				'const keys = ["ass" + "ign"];',
				"const [assign_key] = keys;",
				'const source = Object[assign_key]({ concat_key: "concat_run" }, {});',
				"const { concat_key } = source;",
				"class ConcatAssignObjectCallables { [concat_key](): void {} }",
				"const { concat_run } = new ConcatAssignObjectCallables();",
				"const concat_service = { concat_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects aliased concatenated array computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-array-alias-concat.ts": [
				'const suffix = "ign";',
				'const keys = ["ass" + suffix];',
				"const [assign_key] = keys;",
				'const source = Object[assign_key]({ alias_concat_key: "alias_concat_run" }, {});',
				"const { alias_concat_key } = source;",
				"class AliasConcatAssignObjectCallables { [alias_concat_key](): void {} }",
				"const { alias_concat_run } = new AliasConcatAssignObjectCallables();",
				"const alias_concat_service = { alias_concat_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects template array computed Object.assign key aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-array-template.ts": [
				'const suffix = "ign";',
				"const keys = [`ass${suffix}`];",
				"const [assign_key] = keys;",
				'const source = Object[assign_key]({ template_key: "template_run" }, {});',
				"const { template_key } = source;",
				"class TemplateAssignObjectCallables { [template_key](): void {} }",
				"const { template_run } = new TemplateAssignObjectCallables();",
				"const template_service = { template_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects spread Object.assign object sources", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-object-spread.ts": [
				'const source = Object.assign(...[{ spread_object_key: "spread_object_run" }]);',
				"const { spread_object_key } = source;",
				"class SpreadObjectAssignCallables { [spread_object_key](): void {} }",
				"const { spread_object_run } = new SpreadObjectAssignCallables();",
				"const spread_object_service = { spread_object_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects aliased spread Object.assign object sources", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-object-spread-alias.ts": [
				'const sources = [{ aliased_spread_key: "aliased_spread_run" }];',
				"const source = Object.assign(...sources);",
				"const { aliased_spread_key } = source;",
				"class AliasedSpreadObjectAssignCallables { [aliased_spread_key](): void {} }",
				"const { aliased_spread_run } = new AliasedSpreadObjectAssignCallables();",
				"const aliased_spread_service = { aliased_spread_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("detects indexed spread Object.assign object sources", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"callable-object-assign-object-indexed-spread.ts": [
				'const sources = [[{ indexed_spread_key: "indexed_spread_run" }]][0];',
				"const source = Object.assign(...sources);",
				"const { indexed_spread_key } = source;",
				"class IndexedSpreadObjectAssignCallables { [indexed_spread_key](): void {} }",
				"const { indexed_spread_run } = new IndexedSpreadObjectAssignCallables();",
				"const indexed_spread_service = { indexed_spread_run };",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(1);
	});
});
