import type { LintSourceRecord } from 'src/types';

/** Responsibilities: _source class names collection_, _source type names collection_. **/
export class SourceNames {
	private readonly typescript_language = 'typescript';
	/** Responsibilities: _declared type names addition_. **/
	private append_type_names(names: string[], source: LintSourceRecord): void {
		for (const type_declaration of source.normalized_ast.type_declarations) {
			names.push(type_declaration.name);
		}
	}

	/** Responsibilities: _collection Python class type_. **/
	private python_names(source: LintSourceRecord, include_type_declarations: boolean): string[] {
		const names = source.normalized_ast.classes.map(class_node => class_node.name);
		if (include_type_declarations) {
			this.append_type_names(names, source);
		}
		return names;
	}

	/** Responsibilities: _collection TypeScript class contract_. **/
	public typescript_names(source: LintSourceRecord, include_type_declarations: boolean): string[] {
		const names: string[] = [];
		for (const class_node of source.normalized_ast.classes) {
if (include_type_declarations || (!class_node.type_contract && !class_node.protocol)) {
				names.push(class_node.name);
			}
		}
		return names;
	}

	/** Responsibilities: _collection names according source_. **/
	public names_for_source(source: LintSourceRecord, include_type_declarations: boolean): string[] {
		if (source.language === this.typescript_language) {
			return this.typescript_names(source, include_type_declarations);
		}
		return this.python_names(source, include_type_declarations);
	}
}
