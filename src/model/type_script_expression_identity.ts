import ts from "typescript";

/** Responsibilities: _expression tokenization_, _structural equality comparison_. **/
export class TypeScriptExpressionIdentity {
	private readonly values: WeakMap<ts.Node, string>;

	/** Responsibilities: _expression token scanning_. **/
	private tokens(node: ts.Node): string[] {
		const source_file = node.getSourceFile();
		const scanner = ts.createScanner(
			ts.ScriptTarget.Latest,
			true,
			ts.LanguageVariant.Standard,
			source_file.text,
			undefined,
			node.getStart(source_file),
			node.end - node.getStart(source_file),
		);
		const values: string[] = [];
		let token = scanner.scan();
		while (token !== ts.SyntaxKind.EndOfFileToken) {
			values.push(`${token}:${scanner.getTokenText()}`);
			token = scanner.scan();
		}
		return values;
	}

	/** Responsibilities: _identity cache initialization_. **/
	public constructor() {
		this.values = new WeakMap<ts.Node, string>();
	}

	/** Responsibilities: _expression token identity_. **/
	public value(node: ts.Node): string {
		const cached = this.values.get(node);
		if (cached !== undefined) {
			return cached;
		}
		const value = this.tokens(node).join("|");
		this.values.set(node, value);
		return value;
	}

	/** Responsibilities: _expression identity comparison_. **/
	public equal(left: ts.Node, right: ts.Node): boolean {
		return this.value(left) === this.value(right);
	}
}
