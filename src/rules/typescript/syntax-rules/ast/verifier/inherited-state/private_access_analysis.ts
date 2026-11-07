import { dirname } from "node:path";
import type { StringSetMap } from "src/analysis_types";
import type {
	PrivateAccessAnalysisContract,
	PrivateAccessAnalysisOptions,
	PrivateAccessCandidate,
} from "src/contracts/types/type_script_rule_group_types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptReferenceQueryKind } from "src/model/types";
import { TypeScriptReferenceOwnership } from "src/parser/references/identity/references/type_script_reference_ownership";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { PrivateMemberKeys } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/private_member_keys";
import type { PrivateMemberKeysContract } from "src/shared_services_protocols";
import type { TypeScriptReferenceOwnershipContract } from "src/typescript_analysis_protocols";
import type {
	TypeScriptAstTraversalContract,
	TypeScriptReferenceContextContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _private access indexing_, _cross-owner reporting_. **/
export class PrivateAccessAnalysis implements PrivateAccessAnalysisContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _member_keys: PrivateMemberKeysContract;
	private readonly _members: StringSetMap;
	private readonly _private_member_names: Set<string>;
	private readonly _accesses: ts.AccessExpression[];
	private readonly _owners: string[];
	private readonly _rule: RuleContract;
	private readonly _private_keyword: ts.SyntaxKind;

	/** Responsibilities: _private declaration identification_. **/
	private private_names(member: ts.ClassElement): string[] {
		if (member.name === undefined) {
			return [];
		}
		const private_identifier = ts.isPrivateIdentifier(member.name);
		let modifiers: readonly ts.Modifier[] = [];
		if (ts.canHaveModifiers(member)) {
			const declared_modifiers = ts.getModifiers(member);
			if (declared_modifiers !== undefined) {
				modifiers = declared_modifiers;
			}
		}
		const has_private_modifier = modifiers.some((modifier) => modifier.kind === this._private_keyword);
		if (!private_identifier && !has_private_modifier) {
			return [];
		}
		return [member.name.getText(this._source_file)];
	}

	/** Responsibilities: _private members declared addition_. **/
	private append_class(node: ts.ClassLikeDeclaration): void {
		const name = node.name?.text;
		if (!name) {
			return;
		}
		const private_names = new Set(
			node.members.flatMap((member) => {
				return this.private_names(member);
			}),
		);
		if (private_names.size > 0) {
			this._members.set(name, private_names);
			for (const private_name of private_names) {
				this._private_member_names.add(private_name);
			}
		}
	}

	/** Responsibilities: _private access membership_. **/
	private external_private_access(name: string, target_owner: string, current_owner: string): boolean {
		if (target_owner === "" || target_owner === current_owner || name === "") {
			return false;
		}
		const private_members = this._members.get(target_owner);
		if (private_members === undefined) {
			return false;
		}
		return private_members.has(name);
	}

	/** Responsibilities: _private access name resolution_. **/
	private access_name(access: ts.AccessExpression): string {
		if (ts.isPropertyAccessExpression(access)) {
			return access.name.text;
		}
		if (ts.isElementAccessExpression(access)) {
			return this._member_keys.access_key(access);
		}
		return "";
	}

	/** Responsibilities: _class owner resolution_. **/
	private owner(node: ts.Node): string {
		let current = node.parent;
		while (current !== undefined && !ts.isSourceFile(current)) {
			if (ts.isClassLike(current)) {
				return current.name?.text ?? "";
			}
			current = current.parent;
		}
		return "";
	}

	/** Responsibilities: _external private access reporting_. **/
	private append_access(
		violations: ViolationContract[],
		file: string,
		context: TypeScriptReferenceContextContract,
		candidate: PrivateAccessCandidate,
	): void {
		const { access, current_owner, name } = candidate;
		const resolution = context.resolve_reference({
			kind: TypeScriptReferenceQueryKind.MethodReference,
			expression: access,
			owner: current_owner,
		});
		const target_owner = resolution.owner();
		if (!this.external_private_access(name, target_owner, current_owner)) {
			return;
		}
		const line = access.getSourceFile().getLineAndCharacterOfPosition(access.getStart()).line + 1;
		violations.push(this._rule.violation(file, line, {}));
	}

	/** Responsibilities: _matching private access selection_. **/
	private matching_accesses(): PrivateAccessCandidate[] {
		const candidates: PrivateAccessCandidate[] = [];
		for (let index = 0; index < this._accesses.length; index += 1) {
			const access = this._accesses[index];
			const current_owner = this._owners[index];
			if (access === undefined || current_owner === undefined) {
				continue;
			}
			const name = this.access_name(access);
			if (this._private_member_names.has(name)) {
				candidates.push({ access, current_owner, name });
			}
		}
		return candidates;
	}

	/** Responsibilities: _reference ownership initialization_. **/
	private reference_ownership(): TypeScriptReferenceOwnershipContract {
		return new TypeScriptReferenceOwnership({
			source_file: this._source_file,
			traversal: this._traversal,
			project_root: dirname(this._source_file.fileName),
			stage_timer: new LintStageTimer(),
			source_files: new Map(),
			source_io: new InMemoryProjectSourceIO(new Map()),
		});
	}

	/** Responsibilities: _analysis dependencies_. **/
	public constructor(options: PrivateAccessAnalysisOptions) {
		this._private_keyword = ts.SyntaxKind.PrivateKeyword;
		this._source_file = options.source_file;
		this._traversal = options.traversal;
		this._member_keys = new PrivateMemberKeys(options.static_expression_operations);
		this._members = new Map();
		this._private_member_names = new Set();
		this._accesses = [];
		this._owners = [];
		this._rule = new DiagnosticRule(RULE_IDS.private_member);
	}

	/** Responsibilities: _private access node collection_. **/
	public append_node(node: ts.Node): void {
		if (ts.isClassLike(node)) {
			this.append_class(node);
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			this._accesses.push(node);
			this._owners.push(this.owner(node));
		}
	}

	/** Responsibilities: _private access reporting_. **/
	public append_private_access(violations: ViolationContract[], file: string): void {
		if (this._members.size === 0) {
			return;
		}
		const candidates = this.matching_accesses();
		if (candidates.length === 0) {
			return;
		}
		const context = this.reference_ownership();
		for (const candidate of candidates) {
			this.append_access(violations, file, context, candidate);
		}
	}
}
