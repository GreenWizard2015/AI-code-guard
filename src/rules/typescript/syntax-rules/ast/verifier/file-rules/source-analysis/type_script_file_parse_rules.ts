import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { Syntax } from "src/parser/analysis/syntax";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptDeclarations } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_declarations";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _source syntax issues_, _declaration prefix policy_. **/
export class TypeScriptFileParseRules implements ASTSourceRuleContract {
	private readonly _declaration_candidates: WeakMap<RuleContextContract, ts.Node[]>;

	/** Responsibilities: _declaration prefix policy_. **/
	/** Responsibilities: _declaration candidate accumulation_. **/
	private append_declaration_candidate(context: RuleContextContract, node: ts.Node): void {
		const is_declaration_candidate =
			ts.isFunctionDeclaration(node) || ts.isVariableStatement(node) || ts.isImportDeclaration(node);
		if (!is_declaration_candidate) {
			return;
		}
		let candidates = this._declaration_candidates.get(context);
		if (candidates === undefined) {
			candidates = [];
			this._declaration_candidates.set(context, candidates);
		}
		candidates.push(node);
	}

	/** Responsibilities: _source syntax reporting_. **/
	private append_source_issues(context: RuleContextContract): void {
		const {
			source: { file, normalized_ast },
		} = context.state();
		const violations: ViolationContract[] = [];
		const syntax = new Syntax();
		syntax.append_parse_issues(violations, file, normalized_ast.source.parse_issues, TYPESCRIPT_CACHE_OWNER);
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}

	/** Responsibilities: _declaration candidate initialization_. **/
	public constructor() {
		this._declaration_candidates = new WeakMap();
	}

	/** Responsibilities: _source text eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _source syntax issues_, _declaration prefix policy_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (ts.isSourceFile(request.node)) {
			this.append_source_issues(request.context);
			return;
		}
		this.append_declaration_candidate(request.context, request.node);
	}

	/** Responsibilities: _declaration prefix verification_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const candidates = this._declaration_candidates.get(context);
		this._declaration_candidates.delete(context);
		if (candidates === undefined) {
			return;
		}
		const { file, source_file } = context.state().source;
		const violations: ViolationContract[] = [];
		const declaration_rules = new TypeScriptDeclarations(file, source_file, candidates);
		declaration_rules.append(violations);
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}
}
