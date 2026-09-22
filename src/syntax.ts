import type ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstParseIssue, AstTypeKind } from 'src/types';
import { TypeScriptTypeNode } from 'src/model/typescript-type-node';
import type { ParseLanguage } from 'src/types';

/** Responsibilities: _TypeScript syntax classification_, _diagnostics addition parsing_. **/
export class Syntax {
	private readonly line_separator = '\n';

	/** Responsibilities: _issue addition parsing_. **/
	private append_parse_issue(
		violations: Violation[],
		file: string,
		issue: AstParseIssue,
		language: ParseLanguage
	): void {
		const rule = new DiagnosticRule('parse-error');
		violations.push(
			rule.violation(file, issue.line + 1, {
				language,
				message: issue.message,
			})
		);
	}

	/** Responsibilities: _source-file syntax issue access_. **/
	public syntax_issues(source_file: ts.SourceFile): readonly ts.DiagnosticWithLocation[] {
		const descriptor = Object.getOwnPropertyDescriptor(source_file, 'parseDiagnostics');
if (descriptor === undefined || !Array.isArray(descriptor.value)) {
			return [];
		}
		return descriptor.value;
	}

	/** Responsibilities: _classification TypeScript type node_. **/
	public type_kind(node: ts.TypeNode): AstTypeKind {
		const type_node = new TypeScriptTypeNode(node);
		const details = type_node.details();
		if (details.reference_name.length === 0) {
			return 'basic';
		}
		if (details.reference_arguments.length) {
			return 'generic';
		}
		return 'named';
	}

	/** Responsibilities: _source text normalization segmentation_. **/
	public split_lines(text: string): string[] {
		return text.split(this.line_separator).map(line => {
			if (line.endsWith('\r')) {
				return line.slice(0, -1);
			}
			return line;
		});
	}

	/** Responsibilities: _aggregation parsing issues language_. **/
	public append_parse_issues(
		violations: Violation[],
		file: string,
		issues: AstParseIssue[],
		language: ParseLanguage
	): void {
		for (const issue of issues) {
			this.append_parse_issue(violations, file, issue, language);
		}
	}
}
