import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { IMPORT_RULE_IDS } from "src/rules/constants";
import type { ImportLineIndex } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _import node diagnostics_, _import issue dispatch_. **/
export class TypeScriptImportRules implements ASTSourceRuleContract {
	private readonly _reported_lines: ImportLineIndex;

	/** Responsibilities: _import diagnostic line deduplication_. **/
	private first_report(context: RuleContextContract, line: number): boolean {
		let reported_lines = this._reported_lines.get(context);
		if (reported_lines === undefined) {
			reported_lines = new Set();
			this._reported_lines.set(context, reported_lines);
		}
		if (reported_lines.has(line)) {
			return false;
		}
		reported_lines.add(line);
		return true;
	}

	/** Responsibilities: _import syntax node classification_. **/
	private import_node(node: ts.Node): boolean {
		switch (node.kind) {
			case ts.SyntaxKind.ImportDeclaration:
			case ts.SyntaxKind.ImportEqualsDeclaration:
			case ts.SyntaxKind.CallExpression:
			case ts.SyntaxKind.ImportType:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _line import issue diagnostics_. **/
	private append_import_issues(node: ts.Node, context: RuleContextContract, line: number): void {
		const normalized_source = context.state().source.normalized_ast.source;
		for (const issue of normalized_source.import_issues) {
			if (issue.line !== line || issue.kind === "sys_path_mutation") {
				continue;
			}
			context.for_node(node).append_rule(IMPORT_RULE_IDS[issue.kind]);
		}
	}

	/** Responsibilities: _import issue state initialization_. **/
	public constructor() {
		this._reported_lines = new WeakMap();
	}

	/** Responsibilities: _import diagnostic activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("import") || source_code.includes("require");
	}

	/** Responsibilities: _import syntax node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (!this.import_node(node)) {
			return;
		}
		const source_file = context.state().source.source_file;
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		if (!this.first_report(context, line)) {
			return;
		}
		this.append_import_issues(node, context, line);
	}
}
