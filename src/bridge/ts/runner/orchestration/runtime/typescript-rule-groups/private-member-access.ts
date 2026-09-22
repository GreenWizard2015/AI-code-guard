import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { TypeScriptReferenceContext } from 'src/typescript-reference-context';
import type { PrivateMembers, PrivateWalkOptions, PrivateAccessOptions } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _indexing private class members_. **/
export class PrivateMemberAccess {
	private readonly private_keyword = ts.SyntaxKind.PrivateKeyword;
	private readonly private_rule_id = 'private-member';

	/** Responsibilities: _collection private members their_. **/
	private private_members(source_file: ts.SourceFile): PrivateMembers {
		const result: PrivateMembers = new Map();
		const visit = (node: ts.Node): void => {
			if (ts.isClassDeclaration(node)) {
				this.append_class(result, node, source_file);
			} else if (ts.isClassExpression(node)) {
				this.append_class(result, node, source_file);
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
		return result;
	}

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
			new Set(node.members.flatMap(member => this.private_member_name(member, source_file)))
		);
	}

	/** Responsibilities: _resolution private member names_. **/
	private private_member_name(member: ts.ClassElement, source_file: ts.SourceFile): string[] {
		const name = this.member_name(member, source_file);
		if (member.name && ts.isPrivateIdentifier(member.name) && name) {
			return [name];
		}
		if (this.has_private_modifier(member) && name) {
			return [name];
		}
		return [];
	}

	/** Responsibilities: _private modifier classification_. **/
	private has_private_modifier(member: ts.ClassElement): boolean {
		if (!ts.canHaveModifiers(member)) {
			return false;
		}
		const modifiers = ts.getModifiers(member);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some(item => item.kind === this.private_keyword);
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
			}
			ts.forEachChild(node, child => visit(child, owner));
		};
		visit(source_file);
	}

	/** Responsibilities: _owner traversal enters update_. **/
	private node_owner(node: ts.Node, current_owner: string = ''): string {
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
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
		if (!this.external_private_access(members, access, target_owner, current_owner)) {
			return;
		}
		const line = access.getSourceFile().getLineAndCharacterOfPosition(access.getStart()).line + 1;
		const rule = new DiagnosticRule(this.private_rule_id);
		violations.push(rule.violation(file, line));
	}

	/** Responsibilities: _classification node accesses private_. **/
	private external_private_access(
		members: PrivateMembers,
		access: ts.PropertyAccessExpression,
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
		return private_members.has(access.name.text);
	}

	/** Responsibilities: _resolution public textual name_. **/
	public member_name(member: ts.ClassElement, source_file: ts.SourceFile): string {
		if (!('name' in member)) {
			return '';
		}
		if (!member.name) {
			return '';
		}
		return member.name.getText(source_file);
	}

	/** Responsibilities: _source file aggregation traversal_. **/
	public append_private_access(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const members = this.private_members(source_file);
		const context = new TypeScriptReferenceContext(source_file);
		context.initialize();
		this.walk_nodes({ violations, file, source_file, members, context });
	}
}
