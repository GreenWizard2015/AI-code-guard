import 'src/bridge/ts/core/context-factory';
import 'src/stage-timing';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('AST-detectable array constructor sources', () => {
	test('detects Array.of computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-array-of.ts': [
				'const array_alias = Array;',
				'const { of: array_of } = array_alias;',
				'const keys = array_of("assign");',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ array_of_key: "array_of_run" }, {});',
				'const { array_of_key } = source;',
				'class ArrayOfAssignObjectCallables { [array_of_key](): void {} }',
				'const { array_of_run } = new ArrayOfAssignObjectCallables();',
				'const array_of_service = { array_of_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects Array.from computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-array-from.ts': [
				'const keys = Array.from(["assign"]);',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ array_from_key: "array_from_run" }, {});',
				'const { array_from_key } = source;',
				'class ArrayFromAssignObjectCallables { [array_from_key](): void {} }',
				'const { array_from_run } = new ArrayFromAssignObjectCallables();',
				'const array_from_service = { array_from_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects aliased Array.from computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-array-from-alias.ts': [
				'const array_alias = Array;',
				'const { from: array_from } = array_alias;',
				'const source_keys = ["assign"];',
				'const keys = array_from(source_keys);',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ array_from_alias_key: "array_from_alias_run" }, {});',
				'const { array_from_alias_key } = source;',
				'class ArrayFromAliasAssignObjectCallables { [array_from_alias_key](): void {} }',
				'const { array_from_alias_run } = new ArrayFromAliasAssignObjectCallables();',
				'const array_from_alias_service = { array_from_alias_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects Array constructor computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-array-constructor.ts': [
				'const array_alias = Array;',
				'const keys = array_alias("assign");',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ array_constructor_key: "array_constructor_run" }, {});',
				'const { array_constructor_key } = source;',
				'class ArrayConstructorAssignObjectCallables { [array_constructor_key](): void {} }',
				'const { array_constructor_run } = new ArrayConstructorAssignObjectCallables();',
				'const array_constructor_service = { array_constructor_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects new Array computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-new-array.ts': [
				'const keys = new Array("assign");',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ new_array_key: "new_array_run" }, {});',
				'const { new_array_key } = source;',
				'class NewArrayAssignObjectCallables { [new_array_key](): void {} }',
				'const { new_array_run } = new NewArrayAssignObjectCallables();',
				'const new_array_service = { new_array_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects spread new Array computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-new-array-spread.ts': [
				'const keys = new Array(...["assign"]);',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ new_array_spread_key: "new_array_spread_run" }, {});',
				'const { new_array_spread_key } = source;',
				'class NewArraySpreadAssignObjectCallables { [new_array_spread_key](): void {} }',
				'const { new_array_spread_run } = new NewArraySpreadAssignObjectCallables();',
				'const new_array_spread_service = { new_array_spread_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects spread Array.from computed Object.assign key aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-array-from-spread.ts': [
				'const keys = Array.from(...[["assign"]]);',
				'const [assign_key] = keys;',
				'const source = Object[assign_key]({ array_from_spread_key: "array_from_spread_run" }, {});',
				'const { array_from_spread_key } = source;',
				'class ArrayFromSpreadAssignObjectCallables { [array_from_spread_key](): void {} }',
				'const { array_from_spread_run } = new ArrayFromSpreadAssignObjectCallables();',
				'const array_from_spread_service = { array_from_spread_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects aliased indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-alias.ts': [
				'const index = 0;',
				'const sources = [[{ indexed_alias_key: "indexed_alias_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_alias_key } = source;',
				'class IndexedAliasSpreadObjectAssignCallables { [indexed_alias_key](): void {} }',
				'const { indexed_alias_run } = new IndexedAliasSpreadObjectAssignCallables();',
				'const indexed_alias_service = { indexed_alias_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects transitive indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-transitive.ts': [
				'const base_index = 0;',
				'const index = base_index;',
				'const sources = [[{ indexed_transitive_key: "indexed_transitive_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_transitive_key } = source;',
				'class IndexedTransitiveSpreadObjectAssignCallables { [indexed_transitive_key](): void {} }',
				'const { indexed_transitive_run } = new IndexedTransitiveSpreadObjectAssignCallables();',
				'const indexed_transitive_service = { indexed_transitive_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects unary indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-unary.ts': [
				'const index = +0;',
				'const sources = [[{ indexed_unary_key: "indexed_unary_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_unary_key } = source;',
				'class IndexedUnarySpreadObjectAssignCallables { [indexed_unary_key](): void {} }',
				'const { indexed_unary_run } = new IndexedUnarySpreadObjectAssignCallables();',
				'const indexed_unary_service = { indexed_unary_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects arithmetic indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-arithmetic.ts': [
				'const index = 1 - 1;',
				'const sources = [[{ indexed_arithmetic_key: "indexed_arithmetic_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_arithmetic_key } = source;',
				'class IndexedArithmeticSpreadObjectAssignCallables { [indexed_arithmetic_key](): void {} }',
				'const { indexed_arithmetic_run } = new IndexedArithmeticSpreadObjectAssignCallables();',
				'const indexed_arithmetic_service = { indexed_arithmetic_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects bitwise indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-bitwise.ts': [
				'const index = 0 | 0;',
				'const sources = [[{ indexed_bitwise_key: "indexed_bitwise_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_bitwise_key } = source;',
				'class IndexedBitwiseSpreadObjectAssignCallables { [indexed_bitwise_key](): void {} }',
				'const { indexed_bitwise_run } = new IndexedBitwiseSpreadObjectAssignCallables();',
				'const indexed_bitwise_service = { indexed_bitwise_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects conditional indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-conditional.ts': [
				'const index = true ? 0 : 0;',
				'const sources = [[{ indexed_conditional_key: "indexed_conditional_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_conditional_key } = source;',
				'class IndexedConditionalSpreadObjectAssignCallables { [indexed_conditional_key](): void {} }',
				'const { indexed_conditional_run } = new IndexedConditionalSpreadObjectAssignCallables();',
				'const indexed_conditional_service = { indexed_conditional_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});

	test('detects logical indexed spread Object.assign object sources', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callable-object-assign-object-indexed-spread-logical.ts': [
				'const index = 0 || 0;',
				'const sources = [[{ indexed_logical_key: "indexed_logical_run" }]][index];',
				'const source = Object.assign(...sources);',
				'const { indexed_logical_key } = source;',
				'class IndexedLogicalSpreadObjectAssignCallables { [indexed_logical_key](): void {} }',
				'const { indexed_logical_run } = new IndexedLogicalSpreadObjectAssignCallables();',
				'const indexed_logical_service = { indexed_logical_run };',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-fake-object')).toHaveLength(1);
	});
});
