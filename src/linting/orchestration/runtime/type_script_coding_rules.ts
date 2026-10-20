import { Syntax } from "src/parser/analysis/syntax";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_rule_context";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { dirname } from "node:path";
import { AstPropertySourceIndexCache } from "src/ast_property_source_index_cache";
import { EmptySourceText } from "src/io/empty_source_text";
import { TypeScriptNodeRules } from "src/rules/typescript/syntax-rules/ast/type_script_node_rules";

/** Responsibilities: _recover TypeScript rule source_, _recovered violations collection_. **/
export class TypeScriptCodingRules {
	private readonly recovered_prefix = "function recovered() { ";
	private readonly recovered_suffix = " }";
	private readonly recovered_catch = "try {} catch {}";

	/** Responsibilities: _collection violations recovered source_. **/
	private recovered_violations(file: string, source: string): ViolationContract[] {
		const ast_file = new TypeScriptAstFile(file, source);
		const source_file = ast_file.source_file;
		const violations: ViolationContract[] = [];
		const context = new TypeScriptRuleContext(violations, file, source_file, {
			stage_timer: new LintStageTimer(),
			source_resolver: new Map(),
			node_rules: new TypeScriptNodeRules(),
			module_exports: new TypeScriptModuleExports(dirname(file), new Map(), false, new EmptySourceText()),
			source_index: new AstPropertySourceIndexCache(),
			traversal: ast_file.traversal,
		});
		context.append(source_file);
		return violations;
	}

	/** Responsibilities: _aggregation violations recovered line_. **/
	private append_recovered_line(violations: ViolationContract[], file: string, line: number, source: string): void {
		const recovered = this.recover_rule_source(source);
		if (recovered.length === 0) {
			return;
		}
		const recovered_violations = this.recovered_violations(file, recovered);
		violations.push(...recovered_violations.map((violation) => violation.with_line(line + 1)));
	}

	/** Responsibilities: _aggregation recovered rules source_. **/
	public append_recovered_rules(violations: ViolationContract[], file: string, text: string): void {
		const syntax = new Syntax();
		for (const [line, source] of syntax.split_lines(text).entries()) {
			this.append_recovered_line(violations, file, line, source);
		}
	}

	/** Responsibilities: _source line rule wrapping_. **/
	public recover_rule_source(source: string): string {
		const trimmed = source.trim();
		if (!trimmed) {
			return "";
		}
		if (trimmed.includes("catch")) {
			return this.recovered_catch;
		}
		return `${this.recovered_prefix}${trimmed}${this.recovered_suffix}`;
	}
}
