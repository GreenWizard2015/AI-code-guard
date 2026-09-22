import { Syntax } from 'src/syntax';
import { TypeScriptImportIssues } from 'src/bridge/ts/parser/typescript-import-issues';
import { TypeScriptSymbolDeclaration } from 'src/bridge/ts/parser/typescript-symbol-declaration';
import { TypeScriptTypeDeclarations } from 'src/bridge/ts/parser/typescript-type-declarations';
import { TypeScriptTypeMembers } from 'src/bridge/ts/parser/typescript-type-members';
import { TypeScriptResponsibilityTargets } from 'src/model/typescript-responsibility-targets';
import ts from 'typescript';
import { TypeScriptCallReferenceCollector } from 'src/parser/ts/typescript-call-references';
import type {
	AstCallableNode,
	AstClassNode,
	LineDepth,
	AstParseIssue,
	AstSourceSpan,
	NamedLine,
	NamedSymbol,
	NormalizedAstFile,
	TypeScriptTreeMetadata,
} from 'src/types';

/** Responsibilities: _collection TypeScript syntax module_. **/
export class TypeScriptAstMetadata {
	private readonly source_file: ts.SourceFile;
	private readonly call_reference_collector: TypeScriptCallReferenceCollector;
	private readonly syntax = new Syntax();
	private readonly import_issues = new TypeScriptImportIssues();
	private readonly symbol_declaration = new TypeScriptSymbolDeclaration();
	private readonly type_declarations = new TypeScriptTypeDeclarations();
	private readonly type_members = new TypeScriptTypeMembers();
	private readonly responsibility_targets: TypeScriptResponsibilityTargets;

	/** Responsibilities: _calculation depth property-access chain_. **/
	private attribute_access_depth(node: ts.PropertyAccessExpression): number {
		let depth = 2;
		let expression = node.expression;
		while (ts.isPropertyAccessExpression(expression)) {
			depth += 1;
			expression = expression.expression;
		}
		return depth;
	}

	/** Responsibilities: _statement position normalization conversion_. **/
	private statement_span(statement: ts.Statement): AstSourceSpan {
		const start = this.source_file.getLineAndCharacterOfPosition(statement.getStart(this.source_file));
		const end = this.source_file.getLineAndCharacterOfPosition(statement.end);
		return {
			start_line: start.line,
			start_column: start.character,
			end_line: end.line,
			end_column: end.character,
		};
	}

	/** Responsibilities: _collection source spans module_. **/
	private module_constant_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this.source_file.statements) {
if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
				continue;
			}
			spans.push(this.statement_span(statement));
		}
		return spans;
	}

	/** Responsibilities: _collection source spans module_. **/
	private module_type_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this.source_file.statements) {
if (ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) {
				spans.push(this.statement_span(statement));
			}
		}
		return spans;
	}

	/** Responsibilities: _collection source spans module_. **/
	private module_protocol_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this.source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				spans.push(this.statement_span(statement));
			}
		}
		return spans;
	}

	/** Responsibilities: _derivation imports spans depth_. **/
	private tree_metadata(line_for: (position: number) => number): TypeScriptTreeMetadata {
		const attribute_accesses: LineDepth[] = [];
		const import_issues = this.import_issues.late_import_issues(this.source_file, line_for);
		const named_symbols: NamedSymbol[] = this.symbol_declaration.collect_named_symbols(this.source_file);
		const type_declarations: NamedLine[] = [];
		const visit = (node: ts.Node): void => {
			import_issues.push(...this.import_issues.node_import_issues(node, this.source_file, line_for));
			type_declarations.push(...this.type_declarations.declaration_for(node, this.source_file));
if (ts.isPropertyAccessExpression(node) && !ts.isPropertyAccessExpression(node.parent)) {
				const depth = this.attribute_access_depth(node);
				if (depth > 4) {
					attribute_accesses.push({
						line: line_for(node.getStart(this.source_file)),
						depth,
					});
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(this.source_file);
		return { attribute_accesses, import_issues, named_symbols, type_declarations };
	}

	/** Responsibilities: _initialization source text AST_. **/
	public constructor(
		source_file: ts.SourceFile,
		call_reference_collector: TypeScriptCallReferenceCollector
	) {
		this.source_file = source_file;
		this.call_reference_collector = call_reference_collector;
		this.responsibility_targets = new TypeScriptResponsibilityTargets(source_file);
	}

	/** Responsibilities: _collection syntax policy issues_. **/
	public collect_syntax_issues(line_for: (position: number) => number): AstParseIssue[] {
		const diagnostics = this.syntax.syntax_issues(this.source_file);
		if (diagnostics.length === 0) {
			return [];
		}
		return diagnostics.map(diagnostic => {
			let start = diagnostic.start;
			if (start === undefined) {
				start = 0;
			}
			return {
				line: line_for(start),
				message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
			};
		});
	}

	/** Responsibilities: _combination parsing classes functions_. **/
	public normalized(classes: AstClassNode[], functions: AstCallableNode[]): NormalizedAstFile {
		const line_for = (position: number): number =>
			this.source_file.getLineAndCharacterOfPosition(position).line;
		const tree = this.tree_metadata(line_for);
		return {
			language: 'typescript',
			classes,
			functions,
			parse_issues: this.collect_syntax_issues(line_for),
			import_issues: tree.import_issues,
			attribute_accesses: tree.attribute_accesses,
			module_constant_spans: this.module_constant_spans(),
			module_type_spans: this.module_type_spans(),
			module_protocol_spans: this.module_protocol_spans(),
			call_references: this.call_reference_collector.collect(),
			private_accesses: [], repeated_branches: [], module_instances: [], coding_issues: [],
			python_imports: [], python_main_guard: false, docstring_spans: [],
			responsibility_targets: this.responsibility_targets.collect(),
			named_symbols: tree.named_symbols,
			type_declarations: tree.type_declarations,
			reference_aliases: this.type_declarations.collect_reference_aliases(this.source_file),
			type_members: this.type_members.collect_type_members(this.source_file),
		};
	}
}
