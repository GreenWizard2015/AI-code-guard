import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';

/** Responsibilities: _identification dictionary contracts reporting_. **/
export class DictionaryReturns {
	private readonly dictionary_rule_id = 'typescript-dictionary-return';

	/** Responsibilities: _classification type member represents_. **/
	private is_behavior_member(member: ts.TypeElement): boolean {
		if (ts.isMethodSignature(member)) {
			return true;
		}
		return ts.isCallSignatureDeclaration(member);
	}

	/** Responsibilities: _aggregation dictionary result violation_. **/
	private append_dictionary_return(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		types: Set<string>,
		statement: ts.Statement
	): void {
		if (!this.is_dictionary_return(statement, types)) {
			return;
		}
		if (!ts.isFunctionDeclaration(statement)) {
			return;
		}
		const line =
			source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line + 1;
		const rule = new DiagnosticRule(this.dictionary_rule_id);
		violations.push(rule.violation(file, line));
	}

	/** Responsibilities: _classification statement output inline_. **/
	private is_dictionary_return(statement: ts.Statement, types: Set<string>): boolean {
		if (!ts.isFunctionDeclaration(statement) || !statement.type) {
			return false;
		}
if (!ts.isTypeReferenceNode(statement.type) || !ts.isIdentifier(statement.type.typeName)) {
			return false;
		}
		return types.has(statement.type.typeName.text);
	}

	/** Responsibilities: _collection names dictionary-shaped type_. **/
	public dictionary_types(source_file: ts.SourceFile): Set<string> {
		const types = new Set<string>();
		for (const statement of source_file.statements) {
if (!ts.isTypeAliasDeclaration(statement) || !ts.isTypeLiteralNode(statement.type)) {
				continue;
			}
			if (statement.type.members.some(member => this.is_behavior_member(member))) {
				types.add(statement.name.text);
			}
		}
		return types;
	}

	/** Responsibilities: _collection dictionary result violations_. **/
	public dictionary_return_info(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const types = this.dictionary_types(source_file);
		for (const statement of source_file.statements)
			this.append_dictionary_return(violations, file, source_file, types, statement);
	}
}
