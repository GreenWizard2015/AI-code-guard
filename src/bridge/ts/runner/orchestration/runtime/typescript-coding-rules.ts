import { Syntax } from 'src/syntax';
import type { Violation } from 'src/protocols';
import { TypeScriptRuleContext } from 'src/rules/typescript/typescript-rule-context';
import { TypeScriptAstFile } from 'src/model/typescript-ast';

/** Responsibilities: _recover TypeScript rule source_, _recovered violations collection_. **/
export class TypeScriptCodingRules {
	private readonly recovered_prefix = 'function recovered() { ';
	private readonly recovered_suffix = ' }';
	private readonly recovered_catch = 'try {} catch {}';

	/** Responsibilities: _collection violations recovered source_. **/
	private recovered_violations(file: string, source: string): Violation[] {
		const source_file = new TypeScriptAstFile(file, source).source_file;
		const violations: Violation[] = [];
		const context = new TypeScriptRuleContext(violations, file, source_file);
		context.append(source_file);
		return violations;
	}

	/** Responsibilities: _aggregation violations recovered line_. **/
	private append_recovered_line(
		violations: Violation[],
		file: string,
		line: number,
		source: string
	): void {
		const recovered = this.recover_rule_source(source);
		if (recovered.length === 0) {
			return;
		}
		const recovered_violations = this.recovered_violations(file, recovered);
		violations.push(...recovered_violations.map(violation => violation.with_line(line + 1)));
	}

	/** Responsibilities: _aggregation recovered rules source_. **/
	public append_recovered_rules(violations: Violation[], file: string, text: string): void {
		const syntax = new Syntax();
		for (const [line, source] of syntax.split_lines(text).entries()) {
			this.append_recovered_line(violations, file, line, source);
		}
	}

	/** Responsibilities: _source line rule wrapping_. **/
	public recover_rule_source(source: string): string {
		const trimmed = source.trim();
		if (!trimmed) {
			return '';
		}
		if (trimmed.includes('catch')) {
			return this.recovered_catch;
		}
		return `${this.recovered_prefix}${trimmed}${this.recovered_suffix}`;
	}
}
