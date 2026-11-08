import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import type { CallableClassNamesByFile, CallableReferenceAliases } from "src/contracts/types/callable_usage_types";
import { CONSTRUCTOR_NAME } from "src/metrics/constants";
import type { CallableDefinition, ParsedFile, SharedCallableKind } from "src/metrics/types";
import type { AstCallableNode, AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { NormalizedAstSource } from "src/model/ast/normalized_ast_types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _source declaration analysis_, _callable eligibility_. **/
export class CallableSourceAnalysis {
	public readonly _file: ParsedFile;
	public readonly _declarations: NormalizedAstSource;
	private readonly _ast: NormalizedAstFile;
	private readonly _reference_aliases: CallableReferenceAliases;
	private readonly _property_decorators: ReadonlySet<string>;
	private readonly _function_kind: SharedCallableKind;

	/** Responsibilities: _source class initialization_. **/
	public constructor(file: ParsedFile) {
		this._file = file;
		this._function_kind = MODULE_FUNCTION_KIND;
		this._ast = file.ast;
		this._declarations = this._ast.source;
		this._reference_aliases = this._ast.references.reference_aliases;
		this._property_decorators = new Set(["property", "cached_property"]);
	}

	/** Responsibilities: _method eligibility_. **/
	public eligible_method(node: AstCallableNode): boolean {
		if (node.identity.visibility === "private" || node.declaration.is_accessor) {
			return false;
		}
		if (node.identity.name === CONSTRUCTOR_NAME) {
			return false;
		}
		if (node.identity.name.startsWith("__") && node.identity.name.endsWith("__")) {
			return false;
		}
		const decorators = node.declaration.decorators;
		if (decorators === undefined) {
			return true;
		}
		return !decorators.some((decorator) => this._property_decorators.has(decorator));
	}

	/** Responsibilities: _source class identity index_. **/
	public class_index(): Map<string, AstClassNode> {
		const classes = new Map<string, AstClassNode>();
		for (const node of this._declarations.classes) {
			classes.set(node.identity.name, node);
		}
		return classes;
	}

	/** Responsibilities: _external base classification_. **/
	public with_external_bases(
		classes_by_file: CallableClassNamesByFile,
		source_import_scope: CallableSourceImportScopeContract,
	): ParsedFile {
		const classes = this._declarations.classes.map((node) => ({
			...node,
			classification: {
				...node.classification,
				extends_external_class: node.structure.base_class_names.some((base_name) => {
					let resolved_name = base_name;
					const alias = this._reference_aliases.find((item) => item.name === base_name);
					if (alias !== undefined) {
						resolved_name = alias.target;
					}
					for (const file_name of source_import_scope.scope_files(this._file)) {
						const names = classes_by_file.get(file_name);
						if (names !== undefined) {
							if (names.has(resolved_name)) {
								return false;
							}
						}
					}
					return true;
				}),
			},
		}));
		const ast = { ...this._file.ast, source: { ...this._file.ast.source, classes } };
		return { ...this._file, ast };
	}

	/** Responsibilities: _module function definitions_. **/
	public function_definitions(): CallableDefinition[] {
		const definitions: CallableDefinition[] = [];
		for (const node of this._declarations.functions) {
			if (node.identity.visibility === "private" || node.declaration.is_accessor) {
				continue;
			}
			definitions.push({ file: this._file.file, kind: this._function_kind, node });
		}
		return definitions;
	}

	/** Responsibilities: _class method definitions_. **/
	public method_definitions(): CallableDefinition[] {
		const definitions: CallableDefinition[] = [];
		for (const class_node of this._declarations.classes) {
			if (class_node.classification.type_contract || class_node.classification.protocol) {
				continue;
			}
			for (const node of class_node.structure.methods) {
				if (!this.eligible_method(node)) {
					continue;
				}
				definitions.push({ file: this._file.file, kind: "method", node });
			}
		}
		return definitions;
	}
}
