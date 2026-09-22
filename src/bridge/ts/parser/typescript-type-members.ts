import ts from 'typescript';
import type { AstTypeMembers } from 'src/types';
import type { TypeMember } from 'src/bridge/ts/parser/types';

/** Responsibilities: _TypeScript type members classification_, _type member metadata collection_. **/
export class TypeScriptTypeMembers {
	private readonly member_kinds = new Set([
		ts.SyntaxKind.PropertySignature,
		ts.SyntaxKind.MethodSignature,
	]);
	private readonly empty_type_name = '';

	/** Responsibilities: _collection member types type_. **/
	private type_member_types(
		declaration: ts.Node
	): Record<string, string> {
if (!ts.isTypeLiteralNode(declaration) && !ts.isInterfaceDeclaration(declaration)) {
			return {};
		}
		const members: TypeMember[] = [];
		for (const member of declaration.members) {
			const value = this.type_member(member);
			members.push(...value);
		}
		return Object.fromEntries(members.map(member => [member.name, member.type]));
	}

	/** Responsibilities: _resolution type member name_. **/
	private member_name(member: ts.TypeElement): string {
		if (member.name === undefined || !ts.isIdentifier(member.name)) {
			return '';
		}
		return member.name.text;
	}

	/** Responsibilities: _normalization TypeScript type member_. **/
	public type_member(member: ts.TypeElement): TypeMember[] {
		if (!this.member_kinds.has(member.kind)) {
			return [];
		}
if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) {
			return [];
		}
		const name = this.member_name(member);
		const type = member.type;
		if (name.length === 0 || type === undefined) {
			return [];
		}
		let type_name = this.empty_type_name;
if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
			type_name = type.typeName.text;
		}
		return [{ name, type: type_name }];
	}

	/** Responsibilities: _collection members interfaces object_. **/
	public collect_type_members(source_file: ts.SourceFile): AstTypeMembers {
		const members: AstTypeMembers = {};
		for (const statement of source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				members[statement.name.text] = this.type_member_types(statement);
				continue;
			}
if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
				members[statement.name.text] = this.type_member_types(statement.type);
			}
		}
		return members;
	}
}
