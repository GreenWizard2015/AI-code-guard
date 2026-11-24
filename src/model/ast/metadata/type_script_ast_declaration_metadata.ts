import ts from "typescript";

import type { AstSourceSpan, AstTypeMemberRecord, AstTypeMembers } from "src/model/ast/normalized_ast_types";
import type { TypeScriptAstDeclarationMetadataOptions, TypeScriptMetadataSpans } from "src/model/types";
import type { TypeMember } from "src/parser/types";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _TypeScript declaration spans_, _type-member metadata_. **/
export class TypeScriptAstDeclarationMetadata {
	private readonly _source_file: ts.SourceFile;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _declaration source range_. **/
	private statement_span(statement: ts.Statement): AstSourceSpan {
		const start = this._source_file.getLineAndCharacterOfPosition(statement.getStart(this._source_file));
		const end = this._source_file.getLineAndCharacterOfPosition(statement.end);
		return {
			start_line: start.line,
			start_column: start.character,
			end_line: end.line,
			end_column: end.character,
		};
	}

	/** Responsibilities: _module constant spans_. **/
	private module_constant_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		const collect = (statements: readonly ts.Statement[]): void => {
			for (const statement of statements) {
				if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
					spans.push(this.statement_span(statement));
					continue;
				}
				if (!ts.isModuleDeclaration(statement) || statement.body === undefined) {
					continue;
				}
				if (ts.isModuleBlock(statement.body)) {
					collect(statement.body.statements);
				}
			}
		};
		collect(this._source_file.statements);
		return spans;
	}

	/** Responsibilities: _type-member declaration_. **/
	private type_member(member: ts.TypeElement): TypeMember[] {
		if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) {
			return [];
		}
		if (member.name === undefined) {
			return [];
		}
		if (!ts.isIdentifier(member.name)) {
			return [];
		}
		if (member.type === undefined) {
			return [];
		}
		let type_name = "";
		if (ts.isTypeReferenceNode(member.type) && ts.isIdentifier(member.type.typeName)) {
			type_name = member.type.typeName.text;
		}
		return [{ name: member.name.text, type: type_name }];
	}

	/** Responsibilities: _declared type members_. **/
	private type_member_types(declaration: ts.Node): AstTypeMemberRecord {
		if (!ts.isTypeLiteralNode(declaration) && !ts.isInterfaceDeclaration(declaration)) {
			return new Map();
		}
		const members = declaration.members.flatMap((member) => this.type_member(member));
		return new Map(members.map((member) => [member.name, member.type]));
	}

	/** Responsibilities: _module type spans_. **/
	private module_type_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this._source_file.statements) {
			if (ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) {
				spans.push(this.statement_span(statement));
			}
		}
		return spans;
	}

	/** Responsibilities: _module protocol spans_. **/
	private module_protocol_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this._source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				spans.push(this.statement_span(statement));
			}
		}
		return spans;
	}

	/** Responsibilities: _TypeScript declaration metadata inputs_. **/
	public constructor(options: TypeScriptAstDeclarationMetadataOptions) {
		this._source_file = options.source_file;
		this._stage_timer = options.stage_timer;
	}

	/** Responsibilities: _source type-member index_. **/
	public collect_type_members(): AstTypeMembers {
		const members: AstTypeMembers = new Map();
		for (const statement of this._source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				members.set(statement.name.text, this.type_member_types(statement));
				continue;
			}
			if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
				members.set(statement.name.text, this.type_member_types(statement.type));
			}
		}
		return members;
	}

	/** Responsibilities: _timed module declaration metadata_. **/
	public metadata_spans(prefix: string): TypeScriptMetadataSpans {
		return {
			module_constant_spans: this._stage_timer.measure(`${prefix}.module-constant-spans`, () =>
				this.module_constant_spans(),
			),
			module_type_spans: this._stage_timer.measure(`${prefix}.module-type-spans`, () => this.module_type_spans()),
			module_protocol_spans: this._stage_timer.measure(`${prefix}.module-protocol-spans`, () =>
				this.module_protocol_spans(),
			),
		};
	}
}
