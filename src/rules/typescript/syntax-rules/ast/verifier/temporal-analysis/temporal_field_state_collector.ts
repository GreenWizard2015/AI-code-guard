import type { TemporalCallableState } from "src/contracts/types/type_script_rule_group_types";
import { TemporalCallableFieldAccessCollector } from "src/rules/typescript/syntax-rules/ast/verifier/temporal-analysis/temporal_callable_field_access_collector";
import ts from "typescript";

/** Responsibilities: _class field access analysis_, _callable state aggregation_. **/
export class TemporalFieldStateCollector {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _callable member classification_. **/
	private is_callable_member(member: ts.Node): boolean {
		if (ts.isMethodDeclaration(member)) {
			return true;
		}
		if (ts.isConstructorDeclaration(member)) {
			return true;
		}
		if (ts.isGetAccessorDeclaration(member)) {
			return true;
		}
		return ts.isSetAccessorDeclaration(member);
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _class callable state collection_. **/
	public callables(node: ts.ClassDeclaration): TemporalCallableState[] {
		const result: TemporalCallableState[] = [];
		for (const member of node.members) {
			if (this.is_callable_member(member)) {
				const callable_state = new TemporalCallableFieldAccessCollector(member);
				callable_state.collect();
				result.push({
					node: member,
					writes: new Set(callable_state.field_names_written()),
					reads: new Set(callable_state.field_names_read()),
				});
			}
		}
		return result;
	}

	/** Responsibilities: _field initialization state_. **/
	public initialized_fields(node: ts.ClassDeclaration): Set<string> {
		const initialized = new Set<string>();
		for (const member of node.members) {
			if (!ts.isPropertyDeclaration(member) || member.initializer === undefined) {
				continue;
			}
			initialized.add(member.name.getText(this._source_file));
		}
		return initialized;
	}
}
