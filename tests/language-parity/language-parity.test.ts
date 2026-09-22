import { describe, expect, test } from '@jest/globals';
import { LanguageParityChecker } from 'tests/language-parity/language-parity-checker';
import { ARCHITECTURE_CASES, DIRECT_CASES, PROJECT_CASES } from 'tests/language-parity/constants';

describe('coding lint language parity', () => {
	test('reports shared type and exception rules for both languages', () => {
		const checker = new LanguageParityChecker();
		const results = checker.direct_results(DIRECT_CASES.slice(0, 5));
		expect(results).toEqual(DIRECT_CASES.slice(0, 5).map(() => [true, true]));
		expect(results).toHaveLength(5);
	});

	test('reports shared value and construction rules for both languages', () => {
		const checker = new LanguageParityChecker();
		const results = checker.direct_results(DIRECT_CASES.slice(5));
		expect(results).toEqual(DIRECT_CASES.slice(5).map(() => [true, true]));
		expect(results).toHaveLength(DIRECT_CASES.length - 5);
	});

	test('reports shared ownership rules for both languages', () => {
		const checker = new LanguageParityChecker();
		const results = checker.architecture_results(ARCHITECTURE_CASES.slice(0, 7));
		expect(results).toEqual(ARCHITECTURE_CASES.slice(0, 7).map(() => [true, true]));
		expect(results).toHaveLength(7);
	});

	test('reports shared contract and architecture rules for both languages', () => {
		const checker = new LanguageParityChecker();
		const results = checker.architecture_results(ARCHITECTURE_CASES.slice(7));
		expect(results).toEqual(ARCHITECTURE_CASES.slice(7).map(() => [true, true]));
		expect(results).toHaveLength(ARCHITECTURE_CASES.length - 7);
	});

	test('reports shared import rules for both languages', () => {
		const checker = new LanguageParityChecker();
		const results = checker.project_results(PROJECT_CASES.slice(0, 4));
		expect(results).toEqual(PROJECT_CASES.slice(0, 4).map(() => [true, true]));
		expect(results).toHaveLength(4);
	});

	test('reports shared placement and ownership metrics for both languages', () => {
		const checker = new LanguageParityChecker();
		const results = checker.project_results(PROJECT_CASES.slice(4));
		expect(results).toEqual(PROJECT_CASES.slice(4).map(() => [true, true]));
		expect(results).toHaveLength(PROJECT_CASES.length - 4);
	});
});
