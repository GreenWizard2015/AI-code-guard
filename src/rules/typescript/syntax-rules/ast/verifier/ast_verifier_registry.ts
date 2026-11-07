import { ASTAncestorRelation } from "src/ast_verifier_protocols";
import type {
	ASTPredicateContract,
	ASTSourceRuleContract,
	ASTVerifierContract,
	ASTVerifierNodeRegistrationContract,
	ASTVerifierRegistryContract,
} from "src/ast_verifier_protocols";
import { ASTNodeKindPredicate } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_node_kind_predicate";
import { ASTVerifier } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_verifier";
import { ASTVerifierPath } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_verifier_path";
import { TypeScriptBehaviorAstRegistrations } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_behavior_ast_registrations";
import { TypeScriptCoreAstRegistrations } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_core_ast_registrations";
import { TypeScriptMetricAstRegistrations } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_metric_ast_registrations";
import { TypeScriptProjectAstRegistrations } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_project_ast_registrations";
import { TypeScriptArrayStateRules } from "src/rules/typescript/syntax-rules/types/array_state/type_script_array_state_rules";
import ts from "typescript";

/** Responsibilities: _AST verifier registration_, _source activation_, _rule composition_. **/
export class ASTVerifierRegistry implements ASTVerifierRegistryContract {
	private readonly _rules: ASTSourceRuleContract[];
	private readonly _paths_by_rule: Map<ASTSourceRuleContract, ASTVerifierNodeRegistrationContract[]>;
	private readonly _signature_verifier_cache: Map<string, ASTVerifierContract>;
	private readonly _array_state_rules: TypeScriptArrayStateRules;
	private readonly _core_registrations: TypeScriptCoreAstRegistrations;
	private readonly _behavior_registrations: TypeScriptBehaviorAstRegistrations;
	private readonly _metric_registrations: TypeScriptMetricAstRegistrations;
	private readonly _project_registrations: TypeScriptProjectAstRegistrations;

	/** Responsibilities: _source active-rule selection_. **/
	private select_active_rules(source_code: string, active_rules: ASTSourceRuleContract[]): string {
		let active_rule_signature = "";
		for (const rule of this._rules) {
			const active = rule.active_for(source_code);
			active_rule_signature += active ? "1" : "0";
			if (active) {
				active_rules.push(rule);
			}
		}
		return active_rule_signature;
	}

	/** Responsibilities: _active-rule verifier composition_. **/
	private compose_verifier(active_rules: readonly ASTSourceRuleContract[]): ASTVerifierContract {
		const verifier = new ASTVerifier(active_rules);
		for (const rule of active_rules) {
			const paths = this._paths_by_rule.get(rule);
			if (paths === undefined) {
				continue;
			}
			for (const path of paths) {
				verifier.register(path);
			}
		}
		return verifier;
	}

	/** Responsibilities: _rule path index initialization_. **/
	public constructor() {
		this._rules = [];
		this._paths_by_rule = new Map();
		this._signature_verifier_cache = new Map();
		this._array_state_rules = new TypeScriptArrayStateRules();
		this._core_registrations = new TypeScriptCoreAstRegistrations(this);
		this._behavior_registrations = new TypeScriptBehaviorAstRegistrations(this);
		this._metric_registrations = new TypeScriptMetricAstRegistrations(this);
		this._project_registrations = new TypeScriptProjectAstRegistrations(this);
	}

	/** Responsibilities: _built-in AST rule registration_. **/
	public initialize(): void {
		this._rules.length = 0;
		this._paths_by_rule.clear();
		this._signature_verifier_cache.clear();
		this._core_registrations.register_all();
		this._behavior_registrations.register_all();
		this._metric_registrations.register_all();
		this._project_registrations.register_all();
		this.register(this._array_state_rules, [
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.ElementAccessExpression,
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.IfStatement,
		]);
	}

	/** Responsibilities: _source-specific verifier assembly_. **/
	public build(source_code: string): ASTVerifierContract {
		const active_rules: ASTSourceRuleContract[] = [];
		const active_rule_signature = this.select_active_rules(source_code, active_rules);
		const cached = this._signature_verifier_cache.get(active_rule_signature);
		if (cached !== undefined) {
			return cached;
		}
		const verifier = this.compose_verifier(active_rules);
		this._signature_verifier_cache.clear();
		this._signature_verifier_cache.set(active_rule_signature, verifier);
		return verifier;
	}

	/** Responsibilities: _node-kind path registration_. **/
	public register(rule: ASTSourceRuleContract, node_kinds: readonly ts.SyntaxKind[]): void {
		let paths = this._paths_by_rule.get(rule);
		if (paths === undefined) {
			paths = [];
			this._paths_by_rule.set(rule, paths);
			this._rules.push(rule);
		}
		this._signature_verifier_cache.clear();
		for (const node_kind of node_kinds) {
			const predicate = new ASTNodeKindPredicate(node_kind, ASTAncestorRelation.Parent);
			paths.push(new ASTVerifierPath([predicate], rule));
		}
	}

	/** Responsibilities: _predicate path registration_. **/
	public register_path(rule: ASTSourceRuleContract, predicates: readonly ASTPredicateContract[]): void {
		let paths = this._paths_by_rule.get(rule);
		if (paths === undefined) {
			paths = [];
			this._paths_by_rule.set(rule, paths);
			this._rules.push(rule);
		}
		this._signature_verifier_cache.clear();
		paths.push(new ASTVerifierPath(predicates, rule));
	}
}
