import type { ViolationContract } from "src/reporting_protocols";
import type { RuleContextContract } from "src/types";
import type {
	CallableTypeScriptNodeVerifier,
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import type ts from "typescript";

/** Responsibilities: _project AST rule analysis_, _project rule violations_. **/
export interface TypeScriptProjectAnalysisContract {
	collect_project_violations(request: TypeScriptNodeVerificationRequest): ViolationContract[];
}

/** Responsibilities: _AST verifier operations_. **/
export interface ASTVerifierContract {
	name(): string;
	verifiers(node: ts.Node): readonly ASTNodeVerificationContract[];
	verify(node: ts.Node, context: RuleContextContract): void;
	verify_source_file(request: TypeScriptSourceVerificationRequest): void;
}

/** Responsibilities: _AST node verification_. **/
export interface ASTNodeVerificationContract {
	verify(request: TypeScriptNodeVerificationRequest): void;
}

/** Responsibilities: _source-aware AST rule_. **/
export interface ASTSourceRuleContract extends ASTNodeVerificationContract {
	active_for(source_code: string): boolean;
	finish_source?(request: TypeScriptSourceVerificationRequest): void;
}

/** Responsibilities: _AST path predicate operations_. **/
export enum ASTAncestorRelation {
	Parent = 0,
	AnyAncestor = 1,
}

/** Responsibilities: _AST predicate contract_. **/
export interface ASTPredicateContract {
	node_kind(): ts.SyntaxKind;
	matches_node_kind(kind: ts.SyntaxKind): boolean;
	outer_candidates(node: ts.Node): Iterable<ts.Node>;
}

/** Responsibilities: _AST verifier node registration_. **/
export interface ASTVerifierNodeRegistrationContract {
	node_kind(): ts.SyntaxKind;
	kind_only(): boolean;
	append_to(groups: ASTVerifierNodeGroupContract[]): void;
	matches_node(node: ts.Node): boolean;
}

/** Responsibilities: _AST verifier grouping_. **/
export interface ASTVerifierNodeGroupContract {
	shares_verifier(verifier: ASTNodeVerificationContract): boolean;
	append_registration(registration: ASTVerifierNodeRegistrationContract): void;
	append_match(node: ts.Node, selected: ASTNodeVerificationContract[]): void;
	verify_if_match(request: TypeScriptNodeVerificationRequest): boolean;
}

/** Responsibilities: _AST verifier registration_. **/
export interface ASTVerifierRegistrationContract {
	register(verifier: ASTSourceRuleContract, node_kinds: readonly ts.SyntaxKind[]): void;
}

/** Responsibilities: _AST verifier registry operations_. **/
export interface ASTVerifierRegistryContract extends ASTVerifierRegistrationContract {
	initialize(): void;
	build(source_code: string): ASTVerifierContract;
}

/** Responsibilities: _AST verifier operation lookup_. **/
export interface TypeScriptNodeVerifierLookupContract {
	verifier(kind: string): CallableTypeScriptNodeVerifier;
}

/** Responsibilities: _AST verifier catalog initialization_. **/
export interface TypeScriptNodeVerifierCatalogContract
	extends TypeScriptNodeVerifierLookupContract,
		ASTSourceRuleContract {
	initialize(): void;
	register_builtin_rules(registry: ASTVerifierRegistrationContract): void;
}
