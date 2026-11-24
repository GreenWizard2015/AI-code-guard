import { dirname } from "node:path";
import type { StringSetMap } from "src/analysis_types";
import type {
	PrivateAccessAnalysisContract,
	PrivateAccessAnalysisOptions,
	PrivateAccessCandidate,
} from "src/contracts/types/type_script_rule_group_types";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import type { SourceFileMapContract } from "src/core/project-source/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptReferenceQueryKind } from "src/model/types";
import { TypeScriptReferenceOwnership } from "src/parser/references/identity/references/type_script_reference_ownership";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { PrivateMemberKeys } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/private_member_keys";
import type { LintStageTimerContract, PrivateMemberKeysContract } from "src/shared_services_protocols";
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
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _member_keys: PrivateMemberKeysContract;
	private readonly _members: StringSetMap;
	private readonly _private_member_names: Set<string>;
	private readonly _owner_by_name: Map<string, string>;
	private readonly _accesses: ts.AccessExpression[];
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

	/** Responsibilities: _private member owner indexing_. **/
	private append_private_owners(owner: string, names: ReadonlySet<string>): void {
		for (const name of names) {
			this._private_member_names.add(name);
			const existing_owner = this._owner_by_name.get(name);
			if (existing_owner === undefined) {
				this._owner_by_name.set(name, owner);
			} else if (existing_owner !== owner) {
				this._owner_by_name.set(name, "");
			}
		}
	}

	/** Responsibilities: _private members declared addition_. **/
	private append_class(node: ts.ClassLikeDeclaration): void {
		const declaration_name = node.name;
		if (declaration_name === undefined) {
			return;
		}
		const name = declaration_name.text;
		const names = new Set(node.members.flatMap((member) => this.private_names(member)));
		if (names.size === 0) {
			return;
		}
		this._members.set(name, names);
		this.append_private_owners(name, names);
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
				const name = current.name;
				if (name === undefined) {
					return "";
				}
				return name.text;
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
		for (const access of this._accesses) {
			const name = this.access_name(access);
			if (!this._private_member_names.has(name)) {
				continue;
			}
			const current_owner = this.owner(access);
			if (current_owner !== "" && this._owner_by_name.get(name) === current_owner) {
				continue;
			}
			candidates.push({ access, current_owner, name });
		}
		return candidates;
	}

	/** Responsibilities: _reference ownership initialization_. **/
	private reference_ownership(): TypeScriptReferenceOwnershipContract {
		const source_files: SourceFileMapContract = new Map<string, ts.SourceFile>();
		const source_map_cache = new SourceFileMapCache();
		const source_resolver = source_map_cache.for_map(source_files);
		return new TypeScriptReferenceOwnership({
			source_file: this._source_file,
			traversal: this._traversal,
			project_root: dirname(this._source_file.fileName),
			stage_timer: this._stage_timer,
			stage_name_prefix: "file-analysis.typescript.script-rule.private-member-access.reference-resolution",
			resolve_imports: false,
			source_files: source_resolver,
			source_io: new InMemoryProjectSourceIO(new Map()),
		});
	}

	/** Responsibilities: _analysis dependencies_. **/
	public constructor(options: PrivateAccessAnalysisOptions) {
		this._private_keyword = ts.SyntaxKind.PrivateKeyword;
		this._source_file = options.source_file;
		this._traversal = options.traversal;
		this._stage_timer = options.stage_timer;
		this._member_keys = new PrivateMemberKeys(options.static_expression_operations);
		this._members = new Map();
		this._private_member_names = new Set();
		this._owner_by_name = new Map();
		this._accesses = [];
		this._rule = new DiagnosticRule(RULE_IDS.private_member);
	}

	/** Responsibilities: _private access node collection_. **/
	public append_node(node: ts.Node): void {
		if (ts.isClassLike(node)) {
			this.append_class(node);
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			this._accesses.push(node);
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
