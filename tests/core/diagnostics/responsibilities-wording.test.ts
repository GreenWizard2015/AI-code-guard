import { describe, expect, test } from '@jest/globals';
import type { AstResponsibilityTarget } from 'src/types';
import { ResponsibilityRules } from 'src/bridge/ts/runner/orchestration/runtime/responsibility-wording/responsibility-rules';
import type { ResponsibilityWordingChecker } from 'src/bridge/ts/runner/orchestration/runtime/protocols';
import { ResponsibilityWording } from 'src/bridge/ts/runner/orchestration/runtime/responsibility-wording/responsibility-wording';

describe('Responsibilities wording rule', () => {
	test('checks every word while separating noun forms', () => {
		const checker = new ResponsibilityWording(
			new Set(['validate', 'processing']),
			new Set(),
			new Set(['processing']),
		);

		expect(checker.valid(['user validate'])).toBe(false);
		expect(checker.valid(['data processing'])).toBe(true);
	});

	test('delegates wording validation to the injected checker', () => {
		let checked_values: readonly string[] = [];
		const checker: ResponsibilityWordingChecker = {
			valid(values): boolean {
				checked_values = values;
				return false;
			},
		};
		const rules = new ResponsibilityRules(checker);
		const target: AstResponsibilityTarget = {
			kind: 'function',
			name: 'run',
			line: 0,
			documentation: '/** Responsibilities: _owned work_. **/',
		};

		const violations = rules.collect('service.ts', [target]);

		expect(checked_values).toEqual(['owned work']);
		expect(violations).toEqual([
			expect.objectContaining({ rule_id: 'responsibilities-wording' }),
		]);
	});

	test('accepts wording when the injected checker approves it', () => {
		const checker: ResponsibilityWordingChecker = {
			valid: () => true,
		};
		const rules = new ResponsibilityRules(checker);
		const target: AstResponsibilityTarget = {
			kind: 'function',
			name: 'run',
			line: 0,
			documentation: '/** Responsibilities: _owned work_. **/',
		};

		expect(rules.collect('service.ts', [target])).toHaveLength(0);
	});
});
