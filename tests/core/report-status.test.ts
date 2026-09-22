import { describe, expect, test } from '@jest/globals';
import { ReportStatus } from 'src/bridge/ts/core/report-status';
import type { ReportViolation } from 'src/bridge/ts/core/types';

	/** Responsibilities: _creation reporting status violations_. **/
class ReportStatusFixture {
	/** Responsibilities: _creation reporting violation fixture_. **/
	public violation(
		file: string,
		priority: ReportViolation['priority'],
		message: string,
	): ReportViolation {
		return {
			file,
			line: 1,
			message,
			hint: 'fix',
			rule_id: 'parse-error',
			priority,
		};
	}
}

describe('report status', () => {
		test('summarizes diagnostics', () => {
		const fixture = new ReportStatusFixture();
		const status = new ReportStatus([
			fixture.violation('a.ts', 2, 'priority 2'),
			fixture.violation('b.ts', 1, 'priority 1'),
		]);
		expect(status.summary()).toBe('Total issues: 2.\nTotal files: 2.');
	});

	test('priority 1 does not fail', () => {
		const fixture = new ReportStatusFixture();
		const status = new ReportStatus([fixture.violation('a.ts', 1, 'priority 1')]);
		expect(status.warnings()).toBe(false);
	});

	test('priorities 2 and 3 fail', () => {
		const fixture = new ReportStatusFixture();
		const priority_2_status = new ReportStatus([fixture.violation('a.ts', 2, 'priority 2')]);
		const priority_3_status = new ReportStatus([fixture.violation('a.ts', 3, 'priority 3')]);
		expect({ priority_2: priority_2_status.warnings(), priority_3: priority_3_status.warnings() }).toEqual({
			priority_2: true,
			priority_3: true,
		});
	});

	test('empty status does not fail', () => {
		const status = new ReportStatus([]);
		expect({ summary: status.summary(), warnings: status.warnings() }).toEqual({
			summary: 'Total issues: 0.\nTotal files: 0.',
			warnings: false,
		});
	});
});
