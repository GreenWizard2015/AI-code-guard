import { DiagnosticRule } from "src/model/diagnostic_rule";
import type {
	PrivateMemberDeclarationNamesContract,
	PrivateMemberKeysContract,
	StringSetMap,
	TypeScriptAstTraversalContract,
	TypeScriptReferenceContextContract,
	ViolationContract,
} from "src/protocols";
import { TypeScriptReferenceOwnership } from "src/parser/references/identity/references/type_script_reference_ownership";
import { EmptySourceText } from "src/io/empty_source_text";
import { RULE_IDS } from "src/constants";
import ts from "typescript";
import { dirname } from "node:path";
import { LintStageTimer } from "src/lint_stage_timer";

/** Responsibilities: _private access indexing_, _cross-owner reporting_. **/
export class PrivateAccessAnalysis {
	private readonly source_file: ts.SourceFile;
	private readonly member_keys: PrivateMemberKeysContract;
	private readonly declaration_names: PrivateMemberDeclarationNamesContract;
	private readonly members: StringSetMap;
	private readonly accesses: ts.AccessExpression[];
	private readonly owners: string[];
	private readonly rule: DiagnosticRule;

	/** Responsibilities: _private members declared addition_. **/
	private append_class(node: ts.ClassLikeDeclaration): void {
		const name = node.name?.text;
		if (!name) {
			return;
		}
		const private_names = new Set(
			node.members.flatMap((member) => {
				if (this.member_keys.member_name(member, this.source_file) === "") {
					return [];
				}
				return this.declaration_names.names(member, this.source_file);
			}),
		);
		if (private_names.size > 0) {
			this.members.set(name, private_names);
		}
	}

	/** Responsibilities: _private access membership_. **/
	private external_private_access(name: string, target_owner: string, current_owner: string): boolean {
		if (target_owner === "" || target_owner === current_owner || name === "") {
			return false;
		}
		const private_members = this.members.get(target_owner);
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
			return this.member_keys.access_key(access);
		}
		return "";
	}

	/** Responsibilities: _external private access reporting_. **/
	private append_access(
		violations: ViolationContract[],
		file: string,
		context: TypeScriptReferenceContextContract,
		access: ts.AccessExpression,
		current_owner: string,
	): void {
		const target_owner = context.method_owner(access, current_owner);
		if (!this.external_private_access(this.access_name(access), target_owner, current_owner)) {
			return;
		}
		const line = access.getSourceFile().getLineAndCharacterOfPosition(access.getStart()).line + 1;
		violations.push(this.rule.violation(file, line));
	}

	/** Responsibilities: _analysis dependencies_. **/
	public constructor(
		source_file: ts.SourceFile,
		member_keys: PrivateMemberKeysContract,
		declaration_names: PrivateMemberDeclarationNamesContract,
	) {
		this.source_file = source_file;
		this.member_keys = member_keys;
		this.declaration_names = declaration_names;
		this.members = new Map();
		this.accesses = [];
		this.owners = [];
		this.rule = new DiagnosticRule(RULE_IDS.private_member);
	}

	/** Responsibilities: _private access collection_. **/
	public collect(traversal: TypeScriptAstTraversalContract): void {
		traversal.visit((node, _, owner) => {
			if (ts.isClassLike(node)) {
				this.append_class(node);
			}
			if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
				this.accesses.push(node);
				this.owners.push(owner);
			}
		});
	}

	/** Responsibilities: _private access reporting_. **/
	public append_violations(violations: ViolationContract[], file: string): void {
		if (this.members.size === 0) {
			return;
		}
		const context = new TypeScriptReferenceOwnership(
			this.source_file,
			dirname(this.source_file.fileName),
			new LintStageTimer(),
			new Map(),
			new EmptySourceText(),
		);
		for (let index = 0; index < this.accesses.length; index += 1) {
			const access = this.accesses[index];
			const owner = this.owners[index];
			if (access === undefined || owner === undefined) {
				continue;
			}
			this.append_access(violations, file, context, access, owner);
		}
	}
}
