import ts from "typescript";

/** Responsibilities: _private member declaration names_. **/
export class PrivateMemberDeclarationNames {
	private readonly private_keyword = ts.SyntaxKind.PrivateKeyword;

	/** Responsibilities: _private identifier detection_. **/
	private private_identifier(member: ts.ClassElement): boolean {
		if (member.name === undefined) {
			return false;
		}
		return ts.isPrivateIdentifier(member.name);
	}

	/** Responsibilities: _private modifier detection_. **/
	private has_private_modifier(member: ts.ClassElement): boolean {
		if (!ts.canHaveModifiers(member)) {
			return false;
		}
		const modifiers = ts.getModifiers(member);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((item) => item.kind === this.private_keyword);
	}

	/** Responsibilities: _class member name resolution_. **/
	public name(member: ts.ClassElement, source_file: ts.SourceFile): string {
		if (member.name === undefined) {
			return "";
		}
		return member.name.getText(source_file);
	}

	/** Responsibilities: _private member name collection_. **/
	public names(member: ts.ClassElement, source_file: ts.SourceFile): string[] {
		const name = this.name(member, source_file);
		if (this.private_identifier(member) && name !== "") {
			return [name];
		}
		if (this.has_private_modifier(member) && name !== "") {
			return [name];
		}
		return [];
	}
}
