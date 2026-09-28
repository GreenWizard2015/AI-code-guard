import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { TypeScriptReferenceContext } from 'src/typescript-reference-context';
import { PrivateMemberKeys } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/private-member-access/private-member-keys';
import { PrivateMemberDeclarationNames } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/private-member-access/private-member-declaration-names';
import type {
	PrivateMembers,
	PrivateWalkOptions,
	PrivateAccessOptions,
	PrivateElementAccessOptions,
} from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _indexing private class members_. **/
export class PrivateMemberAccess {
	private readonly private_rule_id = 'private-member';
	private readonly member_keys = new PrivateMemberKeys();
	private readonly declaration_names = new PrivateMemberDeclarationNames();

	/** Responsibilities: _private members declared addition_. **/
	private append_class(
		result: PrivateMembers,
		node: ts.ClassLikeDeclaration,
		source_file: ts.SourceFile
	): void {
		const name = node.name?.text;
		if (!name) {
			return;
		}
		result.set(
			name,
			new Set(
				node.members.flatMap(member => {
					if (this.member_keys.member_name(member, source_file) === '') {
						return [];
					}
					return this.declaration_names.names(member, source_file);
				})
			)
		);
	}

	/** Responsibilities: _current node preservation_. **/
	private walk_nodes(options: PrivateWalkOptions): void {
		const { violations, file, source_file, members, context } = options;
		const visit = (node: ts.Node, current_owner: string = ''): void => {
			const owner = this.node_owner(node, current_owner);
			if (ts.isPropertyAccessExpression(node)) {
				this.append_violation(violations, file, {
					access: node,
					current_owner: owner,
					members,
					context,
				});
			} else if (ts.isElementAccessExpression(node)) {
				this.append_element_violation({
					violations,
					file,
					access: node,
					current_owner: owner,
					members,
					context,
				});
			}
			ts.forEachChild(node, child => visit(child, owner));
		};
		visit(source_file);
	}

	/** Responsibilities: _owner traversal enters update_. **/
	private node_owner(node: ts.Node, current_owner: string = ''): string {
		if (ts.isClassLike(node)) {
			if (node.name) {
				return node.name.text;
			}
			return '';
		}
		if (current_owner !== undefined) {
		return current_owner;
	}
		return '';
	}

	/** Responsibilities: _aggregation external private-member access_. **/
	private append_violation(
		violations: Violation[],
		file: string,
		options: PrivateAccessOptions
	): void {
		const { access, current_owner, members, context } = options;
		const target_owner = context.method_owner(access, current_owner);
		if (!this.external_private_access(members, access.name.text, target_owner, current_owner)) {
			return;
		}
		const line = access.getSourceFile().getLineAndCharacterOfPosition(access.getStart()).line + 1;
		const rule = new DiagnosticRule(this.private_rule_id);
		violations.push(rule.violation(file, line));
	}

	/** Responsibilities: _aggregation element private access_. **/
	private append_element_violation(
		options: PrivateElementAccessOptions
	): void {
		const { violations, file, access, current_owner, members, context } = options;
		const name = this.member_keys.access_key(access);
		const target_owner = context.method_owner(access, current_owner);
		if (!this.external_private_access(members, name, target_owner, current_owner)) {
			return;
		}
		const line = access.getSourceFile().getLineAndCharacterOfPosition(access.getStart()).line + 1;
		const rule = new DiagnosticRule(this.private_rule_id);
		violations.push(rule.violation(file, line));
	}

	/** Responsibilities: _classification node accesses private_. **/
	private external_private_access(
		members: PrivateMembers,
		name: string,
		target_owner: string = '',
		current_owner: string = ''
	): boolean {
		if (!target_owner || target_owner === current_owner) {
			return false;
		}
		const private_members = members.get(target_owner);
		if (private_members === undefined) {
			return false;
		}
		if (name === '') {
			return false;
		}
		return private_members.has(name);
	}

	/** Responsibilities: _private member index_. **/
	public members(source_file: ts.SourceFile): PrivateMembers {
		const result: PrivateMembers = new Map();
		const visit = (node: ts.Node): void => {
			if (ts.isClassLike(node)) {
				this.append_class(result, node, source_file);
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
		return result;
	}

	/** Responsibilities: _source file aggregation traversal_. **/
	public append_private_access(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const members = this.members(source_file);
		const context = new TypeScriptReferenceContext(source_file);
		context.initialize();
		this.walk_nodes({ violations, file, source_file, members, context });
	}
}
