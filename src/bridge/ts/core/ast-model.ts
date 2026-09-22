import type { AstClassNode, AstLanguage, NormalizedAstFile } from 'src/types';

/** Responsibilities: _class inheritance metadata normalization_, _empty AST files creation_. **/
export class AstModel {
	private readonly base_name_precedence = ['base_class_names', 'base_class_name'] as const;

	/** Responsibilities: _resolution class base-name value_. **/
	private base_name_value(
		node: AstClassNode,
		key: (typeof this.base_name_precedence)[number]
	): string[] {
		const value = node[key];
		if (Array.isArray(value) && value.length > 0) {
			return value;
		}
		if (typeof value === 'string' && value.length > 0) {
			return [value];
		}
		return [];
	}

	/** Responsibilities: _resolution class base names_. **/
	private base_names(node: AstClassNode): string[] {
		for (const key of this.base_name_precedence) {
			const names = this.base_name_value(node, key);
			if (names.length > 0) {
				return names;
			}
		}
		return [];
	}

	/** Responsibilities: _marking bases outside project_. **/
	public mark_external_bases(
		classes: AstClassNode[],
		project_class_names: ReadonlySet<string>
	): void {
		for (const class_node of classes) {
			class_node.extends_external_class = this.base_names(class_node).some(
				base => !project_class_names.has(base)
			);
		}
	}

	/** Responsibilities: _creation empty normalization AST_. **/
	public empty_ast_file(language: AstLanguage): NormalizedAstFile {
		return {
			language,
			classes: [],
			functions: [],
			parse_issues: [],
			import_issues: [],
			attribute_accesses: [],
			private_accesses: [],
			repeated_branches: [],
			call_references: [],
			module_constant_spans: [],
			module_type_spans: [],
			module_protocol_spans: [],
			named_symbols: [],
			type_declarations: [],
			reference_aliases: [],
			module_instances: [],
			type_members: {},
			coding_issues: [],
			python_imports: [],
			python_main_guard: false,
			docstring_spans: [],
			responsibility_targets: [],
		};
	}
}
