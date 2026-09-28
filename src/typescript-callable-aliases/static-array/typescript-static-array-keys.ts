import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptStaticArraySources } from 'src/typescript-callable-aliases/static-array/typescript-static-array-sources';
import { TypeScriptStaticArrayValues } from 'src/typescript-callable-aliases/static-array/typescript-static-array-value-resolver';

/** Responsibilities: _classification static array keys_. **/
export class TypeScriptStaticArrayKeys {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly array_sources = new Map<string, readonly ts.Expression[]>();
	private readonly numeric_sources = new Map<string, number>();
	private readonly sources = new TypeScriptStaticArraySources(this.array_sources, this.numeric_sources);
	private readonly values = new TypeScriptStaticArrayValues(this.array_sources, this.numeric_sources);
	private readonly collected = new WeakSet<ts.SourceFile>();

	/** Responsibilities: _collection static array declarations_. **/
	private collect(source_file: ts.SourceFile): void {
		if (this.collected.has(source_file)) {
			return;
		}
		let changed = true;
		while (changed) {
			changed = false;
			const visit = (node: ts.Node): void => {
				if (ts.isVariableDeclaration(node)) {
					if (this.sources.append_source(node)) {
						changed = true;
					}
				}
				ts.forEachChild(node, visit);
			};
			visit(source_file);
		}
		this.collected.add(source_file);
	}

	/** Responsibilities: _resolution static array key_. **/
	public value(expression: ts.Expression, source_file: ts.SourceFile): string {
		const candidates = this.expressions(expression, source_file);
		if (candidates.length !== 1) {
			return '';
		}
		const candidate = this.expression_aliases.unwrapped(candidates[0]);
		if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
			return candidate.text;
		}
		return '';
	}

	/** Responsibilities: _resolution static array expressions_. **/
	public expressions(expression: ts.Expression, source_file: ts.SourceFile): readonly ts.Expression[] {
		this.collect(source_file);
		return this.values.values(expression);
	}
}
