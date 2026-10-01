import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("AST-detectable implementation hacks", () => {
	test("detects callable object literals", () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			"callable-object.ts": [
				"interface Base { run(): void; }",
				"type Derived = Base & { extra(): void };",
				"declare const callables: Derived;",
				"const { run } = callables;",
				"const service = { run };",
				"type Union = Base | { extra(): void }; declare const union_callables: Union; const { run: union_run } = union_callables; const union_service = { union_run };",
				"interface DerivedInterface extends Base {} declare const inherited: DerivedInterface; const { run: inherited_run } = inherited; const inherited_service = { inherited_run };",
				'class Callables { run(): void {} } const { run: class_run } = new Callables(); const class_service = { class_run }; const instance = new Callables(); const { run: instance_run } = instance; const instance_service = { instance_run }; class StaticCallables { static run(): void {} } const { run: static_run } = StaticCallables; const static_service = { static_run }; const Factory = StaticCallables; const { run: static_alias_run } = Factory; const static_alias_service = { static_alias_run }; class BaseClass { inherited(): void {} } class DerivedClass extends BaseClass {} const { inherited: inherited_class_run } = new DerivedClass(); const inherited_class_service = { inherited_class_run }; class ComputedCallables { ["computed_run"](): void {} } const { computed_run } = new ComputedCallables(); const computed_service = { computed_run }; class NumericCallables { [0](): void {} } const { 0: numeric_run } = new NumericCallables(); const numeric_service = { 0: numeric_run }; const computed_key = "aliased_run"; class AliasComputedCallables { [computed_key](): void {} } const { aliased_run } = new AliasComputedCallables(); const aliased_computed_service = { aliased_run }; const [array_key] = ["array_run"]; class ArrayComputedCallables { [array_key](): void {} } const { array_run } = new ArrayComputedCallables(); const array_computed_service = { array_run }; const { object_key } = { object_key: "object_run" }; class ObjectComputedCallables { [object_key](): void {} } const { object_run } = new ObjectComputedCallables(); const object_computed_service = { object_run }; const object_source = ({ object_key: "aliased_object_run" }); const { object_key: aliased_object_key } = object_source; class AliasObjectComputedCallables { [aliased_object_key](): void {} } const { aliased_object_run } = new AliasObjectComputedCallables(); const aliased_object_service = { aliased_object_run }; const property_value = "aliased_property_run"; const property_source = { object_key: property_value }; const { object_key: property_alias_key } = property_source; class PropertyAliasComputedCallables { [property_alias_key](): void {} } const { aliased_property_run } = new PropertyAliasComputedCallables(); const property_alias_service = { aliased_property_run }; const computed_source = { ["computed_object_key"]: "computed_object_run" }; const { computed_object_key: computed_object_alias_key } = computed_source; class ComputedObjectPropertyCallables { [computed_object_alias_key](): void {} } const { computed_object_run } = new ComputedObjectPropertyCallables(); const computed_object_property_service = { computed_object_run }; const computed_object_key_alias = "aliased_computed_object_key"; const computed_alias_source = { [computed_object_key_alias]: "aliased_computed_object_run" }; const { aliased_computed_object_key: computed_alias_key } = computed_alias_source; class ComputedObjectAliasCallables { [computed_alias_key](): void {} } const { aliased_computed_object_run } = new ComputedObjectAliasCallables(); const computed_object_alias_service = { aliased_computed_object_run }; const spread_source = { ...{ spread_key: "spread_run" } }; const { spread_key: spread_alias_key } = spread_source; class SpreadObjectCallables { [spread_alias_key](): void {} } const { spread_run } = new SpreadObjectCallables(); const spread_object_service = { spread_run }; const spread_named = { spread_key: "named_spread_run" }; const spread_named_source = { ...spread_named }; const { spread_key: named_spread_key } = spread_named_source; class NamedSpreadObjectCallables { [named_spread_key](): void {} } const { named_spread_run } = new NamedSpreadObjectCallables(); const named_spread_service = { named_spread_run }; const [{ nested_key }] = [{ nested_key: "nested_run" }]; class NestedArrayObjectCallables { [nested_key](): void {} } const { nested_run } = new NestedArrayObjectCallables(); const nested_array_service = { nested_run }; const { outer: [nested_array_key] } = { outer: ["nested_array_run"] }; class NestedObjectArrayCallables { [nested_array_key](): void {} } const { nested_array_run } = new NestedObjectArrayCallables(); const nested_object_array_service = { nested_array_run }; const { ...rest_source } = { rest_key: "rest_run" }; const { rest_key: rest_alias_key } = rest_source; class RestObjectCallables { [rest_alias_key](): void {} } const { rest_run } = new RestObjectCallables(); const rest_object_service = { rest_run }; const [...array_rest] = ["array_rest_run"]; const [array_rest_key] = array_rest; class ArrayRestObjectCallables { [array_rest_key](): void {} } const { array_rest_run } = new ArrayRestObjectCallables(); const array_rest_service = { array_rest_run }; const spread_array_source = [...["spread_array_run"]]; const [...spread_array_keys] = spread_array_source; const [spread_array_key] = spread_array_keys; class ArraySpreadRestCallables { [spread_array_key](): void {} } const { spread_array_run } = new ArraySpreadRestCallables(); const spread_array_service = { spread_array_run }; const override_source = { ...{ override_key: "wrong" }, override_key: "override_run" }; const { override_key } = override_source; class SpreadOverrideCallables { [override_key](): void {} } const { override_run } = new SpreadOverrideCallables(); const spread_override_service = { override_run }; declare const object_condition: boolean; const conditional_source = object_condition ? { conditional_key: "conditional_run" } : { conditional_key: "conditional_run" }; const { conditional_key } = conditional_source; class ConditionalObjectCallables { [conditional_key](): void {} } const { conditional_run } = new ConditionalObjectCallables(); const conditional_object_service = { conditional_run }; declare const logical_condition: boolean; const logical_source = (logical_condition && { logical_key: "logical_run" }) || { logical_key: "logical_run" }; const { logical_key } = logical_source; class LogicalObjectCallables { [logical_key](): void {} } const { logical_run } = new LogicalObjectCallables(); const logical_object_service = { logical_run }; const comma_source = (void 0, { comma_key: "comma_run" }); const { comma_key } = comma_source; class CommaObjectCallables { [comma_key](): void {} } const { comma_run } = new CommaObjectCallables(); const comma_object_service = { comma_run }; const assign_source = Object.assign({ assign_key: "assign_run" }, {}); const { assign_key } = assign_source; class AssignObjectCallables { [assign_key](): void {} } const { assign_run } = new AssignObjectCallables(); const assign_object_service = { assign_run }; const object_alias = Object; const second_alias = object_alias; const alias_assign_source = second_alias.assign({ alias_assign_key: "alias_assign_run" }, {}); const { alias_assign_key } = alias_assign_source; class AliasAssignObjectCallables { [alias_assign_key](): void {} } const { alias_assign_run } = new AliasAssignObjectCallables(); const alias_assign_object_service = { alias_assign_run };',
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-fake-object")).toHaveLength(30);
	});

	test("detects forwarding functions and methods", () => {
		const fixture = new TestFixture();

		const messages = fixture.violation_messages({
			"forwarding.ts": [
				"function update(id: string, title: string) {",
				"  return flow.update(id, title);",
				"}",
				"class Contact {",
				"  public close_contact_reason(): string {",
				"    return this.required_reason();",
				"  }",
				"}",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid proxy methods and forwarding functions")).toHaveLength(2);
	});

	test("detects TypeScript re-export declarations", () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			"reexport.ts": ["export { Client } from './client';", "export type { ClientOptions } from './client';"].join(
				"\n",
			),
		});

		expect(violations.filter((violation) => violation.rule_id === "reexports")).toHaveLength(2);
	});

	test("detects local exports of imported TypeScript bindings", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"local-reexport.ts": ["import { WebPageTabState } from './state';", "export { WebPageTabState };"].join("\n"),
			"state.ts": "export class WebPageTabState {}",
		});

		expect(violations.filter((violation) => violation.rule_id === "reexports")).toHaveLength(1);
	});

	test("detects default exports of imported TypeScript bindings", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"default-reexport.ts": ["import { Client } from './client';", "export default Client;"].join("\n"),
			"client.ts": "export class Client {}",
		});

		expect(violations.filter((violation) => violation.rule_id === "reexports")).toHaveLength(1);
	});

	test("detects exports of local aliases of imported TypeScript bindings", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"aliased-reexport.ts": [
				"import { Client } from './client';",
				"const client_alias = Client;",
				"export { client_alias };",
			].join("\n"),
			"client.ts": "export class Client {}",
		});

		expect(violations.filter((violation) => violation.rule_id === "reexports")).toHaveLength(1);
	});

	test("detects module-level functions outside the exact root file", () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			"client.ts": "export function create_client(): number { return 1; }\n",
		});

		expect(violations.filter((violation) => violation.rule_id === "function-placement")).toHaveLength(1);
	});

	test("detects module-level class instances", () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			"client.ts": ["class Client {}", "const client = new Client();"].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "singleton")).toHaveLength(1);
	});

	test("rejects object literals returned as project classes or interfaces", () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			"contracts.ts": [
				"export interface User { name(): string; }",
				'export class Session { public id = "session"; public close(): void {} }',
			].join("\n"),
			"factory.ts": [
				"import { Session, User } from './contracts';",
				"type UserAlias = User;",
				'export function create_user(): User { return { name: () => "Ada" }; }',
				'export function create_user_alias(): UserAlias { return { name: () => "Ada" }; }',
				'export function create_session(): Session { return { id: "session", close: () => {} }; }',
			].join("\n"),
			"data.ts": [
				"type UserData = { name: string };",
				'export function create_data(): UserData { return { name: "Ada" }; }',
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "typescript-object-literal-return")).toHaveLength(3);
	});

	test("applies class-like count and size limits to Jest suites", () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			"tests/jest-small.test.ts": ["describe('small', () => {", "  test('only test', () => {});", "});"].join("\n"),
			"tests/jest-large.test.ts": [
				"describe('large', () => {",
				...Array.from({ length: 140 }, (_, index) => `  const value_${index} = ${index};`),
				...Array.from({ length: 16 }, (_, index) => `  test('test ${index}', () => {});`),
				"});",
			].join("\n"),
		});

		expect(violations.map((violation) => violation.rule_id)).toEqual(
			expect.arrayContaining([
				"typescript-jest-min-count",
				"typescript-jest-max-size",
				"typescript-jest-min-size",
				"typescript-jest-max-count",
			]),
		);
	});
});
