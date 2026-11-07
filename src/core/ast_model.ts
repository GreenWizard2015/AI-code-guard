import type { AstModelEmptyReferenceFields, AstModelEmptySourceFields } from "src/core/types";
import type { AstClassNode, AstLanguage, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { AstModelContract, ProjectNameMembershipContract } from "src/source_protocols";

/** Responsibilities: _class inheritance analysis_, _empty AST files creation_. **/
export class AstModel implements AstModelContract {
	private readonly _language: AstLanguage;

	/** Responsibilities: _empty AST source data_. **/
	private empty_source_fields(language: AstLanguage): AstModelEmptySourceFields {
		return {
			source: { language, classes: [], functions: [], parse_issues: [], import_issues: [] },
			references: { attribute_accesses: [] },
		};
	}

	/** Responsibilities: _empty AST references_. **/
	private empty_reference_fields(): AstModelEmptyReferenceFields {
		return {
			references: {
				symbol_references: [],
				literal_references: [],
				literal_constants: [],
				call_references: [],
				type_members: new Map<string, Map<string, string>>(),
				named_symbols: [],
				type_declarations: [],
				reference_aliases: [],
			},
		};
	}

	/** Responsibilities: _language-specific AST model ownership_. **/
	public constructor(language: AstLanguage) {
		this._language = language;
	}

	/** Responsibilities: _marking bases outside project_. **/
	public mark_external_bases(classes: AstClassNode[], project_names: ProjectNameMembershipContract): void {
		for (const [index, class_node] of classes.entries()) {
			classes[index] = {
				...class_node,
				classification: {
					...class_node.classification,
					extends_external_class: class_node.structure.base_class_names.some((base) => !project_names.contains(base)),
				},
			};
		}
	}

	/** Responsibilities: _empty AST file creation_. **/
	public empty_ast_file(): NormalizedAstFile {
		const source_fields = this.empty_source_fields(this._language);
		const reference_fields = this.empty_reference_fields();
		return {
			source: { ...source_fields.source, coding_issues: [], python_imports: [] },
			references: { ...source_fields.references, ...reference_fields.references },
			control_flow: { private_accesses: [], repeated_branches: [], module_instances: [] },
			module_declarations: {
				module_constant_spans: [],
				module_type_spans: [],
				module_protocol_spans: [],
				python_exports: [],
				python_callable_count: { count: 0, first_line: 0 },
				python_main_guard: false,
				docstring_spans: [],
				responsibility_targets: [],
			},
		};
	}
}
