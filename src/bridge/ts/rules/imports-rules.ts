import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstImportIssue } from 'src/types';
import { IMPORT_RULE_IDS } from 'src/bridge/ts/rules/constants';

/** Responsibilities: _import issue kinds mapping_, _import violations addition_. **/
export class ImportsRules {
	private readonly rule_ids = IMPORT_RULE_IDS;

	/** Responsibilities: _resolution rule ID import_. **/
	private rule_id(issue: AstImportIssue): string {
		const rule_id = this.rule_ids[issue.kind];
		if (rule_id === undefined) {
			throw new Error(`Unknown import issue kind "${issue.kind}".`);
		}
		return rule_id;
	}

	/** Responsibilities: _import violation creation_. **/
	public import_violation(file: string, issue: AstImportIssue): Violation {
		const line = issue.line + 1;
		const rule = new DiagnosticRule(this.rule_id(issue));
		return rule.violation(file, line);
	}

	/** Responsibilities: _aggregation violations import issues_. **/
	public append_import_violations(
		violations: Violation[],
		file: string,
		issues: AstImportIssue[]
	): void {
		if (issues.length === 0) {
			return;
		}
		for (const issue of issues) {
			violations.push(this.import_violation(file, issue));
		}
	}
}
