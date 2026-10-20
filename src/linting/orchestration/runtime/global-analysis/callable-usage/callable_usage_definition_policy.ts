import { CODING_LINT_PATH_PREFIX } from "src/constants";
import { CONSTRUCTOR_NAME } from "src/metrics/constants";
import type { CallableDefinition, ParsedFile, SharedCallableKind } from "src/metrics/types";
import type { CallableSourceImportScopeContract } from "src/analysis_protocols";
import type { ReadonlyStringSetMap } from "src/analysis_types";
import type { AstClassNode } from "src/types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _callable declaration selection_, _external inheritance classification_. **/
export class CallableUsageDefinitionPolicy {
	private readonly property_decorators: ReadonlySet<string>;
	private readonly function_kind: SharedCallableKind;
	private readonly source_import_scope: CallableSourceImportScopeContract;

	/** Responsibilities: _source declaration resolution_. **/
	private has_declaration(
		source: ParsedFile,
		scope: ReadonlySet<string>,
		name: string,
		class_names: ReadonlyStringSetMap,
	): boolean {
		let resolved_name = name;
		const alias = source.ast.reference_aliases.find((item) => item.name === name);
		if (alias !== undefined) {
			resolved_name = alias.target;
		}
		for (const file of scope) {
			if (class_names.get(file)?.has(resolved_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _callable method eligibility_. **/
	private callable_method(item: CallableDefinition): boolean {
		if (item.file.startsWith(CODING_LINT_PATH_PREFIX)) {
			return false;
		}
		if (item.node.visibility === "private") {
			return false;
		}
		if (item.node.is_accessor) {
			return false;
		}
		if (item.node.name === CONSTRUCTOR_NAME) {
			return false;
		}
		return !(item.node.name.startsWith("__") && item.node.name.endsWith("__"));
	}

	/** Responsibilities: _property callable eligibility_. **/
	private property_callable(item: CallableDefinition): boolean {
		if (!this.callable_method(item)) {
			return false;
		}
		const decorators = item.node.decorators;
		if (decorators === undefined) {
			return true;
		}
		return !decorators.some((name) => this.property_decorators.has(name));
	}

	/** Responsibilities: _callable policy initialization_. **/
	public constructor(source_import_scope: CallableSourceImportScopeContract) {
		this.property_decorators = new Set(["property", "cached_property"]);
		this.function_kind = MODULE_FUNCTION_KIND;
		this.source_import_scope = source_import_scope;
	}

	/** Responsibilities: _callable definition eligibility_. **/
	public callable_definition(item: CallableDefinition): boolean {
		if (item.kind === "method") {
			return this.property_callable(item);
		}
		if (item.file.startsWith(CODING_LINT_PATH_PREFIX)) {
			return false;
		}
		if (item.node.visibility === "private") {
			return false;
		}
		return !item.node.is_accessor;
	}

	/** Responsibilities: _production inheritance classification_. **/
	public mark_external_bases(parsed_files: ParsedFile[]): ParsedFile[] {
		const class_names = new Map(
			parsed_files.map((file) => [file.absolute_file, new Set(file.ast.classes.map((class_node) => class_node.name))]),
		);
		return parsed_files.map((file) => ({
			...file,
			ast: {
				...file.ast,
				classes: file.ast.classes.map((class_node) => ({
					...class_node,
					extends_external_class: this.base_names_for(class_node).some(
						(base) => !this.has_declaration(file, this.source_import_scope.scope_files(file), base, class_names),
					),
				})),
			},
		}));
	}

	/** Responsibilities: _callable definitions collection_. **/
	public callable_definitions(file: ParsedFile): CallableDefinition[] {
		const functions = file.ast.functions.map((node) => ({ file: file.file, kind: this.function_kind, node }));
		const methods = file.ast.classes
			.filter((class_node) => !class_node.type_contract && !class_node.protocol)
			.flatMap((class_node) => class_node.methods.map((node) => ({ file: file.file, kind: "method" as const, node })));
		return [...functions, ...methods];
	}

	/** Responsibilities: _base class name normalization_. **/
	public base_names_for(class_node: AstClassNode): string[] {
		if (class_node.base_class_names.length > 0) {
			return class_node.base_class_names;
		}
		if (class_node.base_class_name.length > 0) {
			return [class_node.base_class_name];
		}
		return [];
	}
}
