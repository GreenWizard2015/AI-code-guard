import type { AstParseIssue, AstTypeKind } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptTypeNode } from "src/model/type_script_type_node";
import type { ViolationContract } from "src/reporting_protocols";
import type { SyntaxContract } from "src/shared_services_protocols";
import type { ParseLanguage } from "src/types";
import type ts from "typescript";

/** Responsibilities: _TypeScript syntax classification_, _diagnostics addition parsing_. **/
export class Syntax implements SyntaxContract {
	private readonly line_separator = "\n";
	private readonly _type_kind_cache: WeakMap<ts.TypeNode, AstTypeKind>;
	private readonly _syntax_issue_cache: WeakMap<ts.SourceFile, readonly ts.DiagnosticWithLocation[]>;

	/** Responsibilities: _issue addition parsing_. **/
	private append_parse_issue(
		violations: ViolationContract[],
		file: string,
		issue: AstParseIssue,
		language: ParseLanguage,
	): void {
		const rule = new DiagnosticRule("parse-error");
		violations.push(
			rule.violation(file, issue.line + 1, {
				language,
				message: issue.message,
			}),
		);
	}

	/** Responsibilities: _syntax cache initialization_. **/
	public constructor() {
		this._type_kind_cache = new WeakMap();
		this._syntax_issue_cache = new WeakMap();
	}

	/** Responsibilities: _source-file syntax issue access_. **/
	public syntax_issues(source_file: ts.SourceFile): readonly ts.DiagnosticWithLocation[] {
		const cached = this._syntax_issue_cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const descriptor = Object.getOwnPropertyDescriptor(source_file, "parseDiagnostics");
		if (descriptor === undefined) {
			this._syntax_issue_cache.set(source_file, []);
			return [];
		}
		if (!Array.isArray(descriptor.value)) {
			this._syntax_issue_cache.set(source_file, []);
			return [];
		}
		this._syntax_issue_cache.set(source_file, descriptor.value);
		return descriptor.value;
	}

	/** Responsibilities: _classification TypeScript type node_. **/
	public type_kind(node: ts.TypeNode): AstTypeKind {
		const cached = this._type_kind_cache.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const type_node = new TypeScriptTypeNode(node);
		const details = type_node.details();
		if (details.reference_name.length === 0) {
			this._type_kind_cache.set(node, "basic");
			return "basic";
		}
		if (details.reference_arguments.length > 0) {
			this._type_kind_cache.set(node, "generic");
			return "generic";
		}
		this._type_kind_cache.set(node, "named");
		return "named";
	}

	/** Responsibilities: _source text normalization segmentation_. **/
	public split_lines(text: string): string[] {
		return text.split(this.line_separator).map((line) => {
			if (line.endsWith("\r")) {
				return line.slice(0, -1);
			}
			return line;
		});
	}

	/** Responsibilities: _aggregation parsing issues language_. **/
	public append_parse_issues(
		violations: ViolationContract[],
		file: string,
		issues: AstParseIssue[],
		language: ParseLanguage,
	): void {
		for (const issue of issues) {
			this.append_parse_issue(violations, file, issue, language);
		}
	}
}
