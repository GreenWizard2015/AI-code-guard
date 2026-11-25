import { dirname } from "node:path";
import { MODULE_CONSTANT_KIND, MODULE_PROTOCOL_KIND } from "src/constants";
import { METRIC_KIND_FUNCTION } from "src/metrics/constants";
import type {
	AstCallableNode,
	AstClassNode,
	NamedLine,
	NamedSymbol,
	NormalizedAstFile,
	NormalizedAstModuleDeclarations,
} from "src/model/ast/normalized_ast_types";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import {
	CODE_CATEGORY_DATA_CLASS,
	CODE_CATEGORY_IMPLEMENTATION,
	CODE_CATEGORY_IMPLEMENTATION_CLASS,
	CODE_CATEGORY_TYPE,
	CODE_CATEGORY_VALUE,
} from "src/rules/constants";
import type { CodeCategoryIndexContract, CodeCategoryTotals } from "src/rules/support/protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _directory code category counts_, _file category uniqueness_. **/
export class CodeCategoryIndex implements CodeCategoryIndexContract {
	private readonly _counts: CodeCategoryTotals;
	private readonly _directories: Map<string, string>;

	/** Responsibilities: _class category_. **/
	private class_category(classes: readonly AstClassNode[]): string {
		for (const item of classes) {
			if (item.classification.is_data_class) {
				return CODE_CATEGORY_DATA_CLASS;
			}
		}
		for (const item of classes) {
			if (item.classification.protocol) {
				return MODULE_PROTOCOL_KIND;
			}
		}
		if (classes.some((item) => item.classification.type_contract)) {
			return CODE_CATEGORY_TYPE;
		}
		if (classes.length > 0) {
			return CODE_CATEGORY_IMPLEMENTATION_CLASS;
		}
		return "";
	}

	/** Responsibilities: _declaration category_. **/
	private declaration_category(
		declarations: NormalizedAstModuleDeclarations,
		type_declarations: readonly NamedLine[],
	): string {
		if (declarations.module_protocol_spans.length > 0) {
			return MODULE_PROTOCOL_KIND;
		}
		if (declarations.module_type_spans.length > 0) {
			return CODE_CATEGORY_TYPE;
		}
		if (type_declarations.length > 0) {
			return CODE_CATEGORY_TYPE;
		}
		if (declarations.module_constant_spans.length > 0) {
			return MODULE_CONSTANT_KIND;
		}
		return "";
	}

	/** Responsibilities: _top-level function category_. **/
	private function_category(functions: readonly AstCallableNode[]): string {
		for (const item of functions) {
			if (item.identity.owner.length === 0 && !item.identity.nested) {
				return METRIC_KIND_FUNCTION;
			}
		}
		return "";
	}

	/** Responsibilities: _module value category_. **/
	private value_category(symbols: readonly NamedSymbol[]): string {
		for (const item of symbols) {
			if (item.is_module_variable && item.name !== "__all__") {
				return CODE_CATEGORY_VALUE;
			}
		}
		return "";
	}

	/** Responsibilities: _class and declaration category_. **/
	private declared_category(
		class_category: string,
		declarations: NormalizedAstModuleDeclarations,
		type_declarations: readonly NamedLine[],
	): string {
		if (class_category.length > 0) {
			return class_category;
		}
		return this.declaration_category(declarations, type_declarations);
	}

	/** Responsibilities: _unclassified source category_. **/
	private fallback_category(source_content: string): string {
		if (source_content.trim().length > 0) {
			return CODE_CATEGORY_IMPLEMENTATION;
		}
		return "";
	}

	/** Responsibilities: _file category_. **/
	private category(ast: NormalizedAstFile, source_content: string): string {
		const declaration_category = this.declared_category(
			this.class_category(ast.source.classes),
			ast.module_declarations,
			ast.references.type_declarations,
		);
		if (declaration_category.length > 0) {
			return declaration_category;
		}
		const functions = this.function_category(ast.source.functions);
		if (functions.length > 0) {
			return functions;
		}
		const value_category = this.value_category(ast.references.named_symbols);
		if (value_category.length > 0) {
			return value_category;
		}
		return this.fallback_category(source_content);
	}

	/** Responsibilities: _category total increment_. **/
	private increment(directory: string, category: string, language: AstLanguage): void {
		const index_key = JSON.stringify([language, directory]);
		let counts = this._counts.get(index_key);
		if (counts === undefined) {
			counts = new Map();
			this._counts.set(index_key, counts);
		}
		counts.set(category, (counts.get(category) ?? 0) + 1);
	}

	/** Responsibilities: _category directory resolution_. **/
	private directory(file: string): string {
		const known_directory = this._directories.get(file);
		if (known_directory !== undefined) {
			return known_directory;
		}
		return dirname(file);
	}

	/** Responsibilities: _category index setup_. **/
	public constructor() {
		this._counts = new Map();
		this._directories = new Map();
	}

	/** Responsibilities: _source category indexing_. **/
	public index_sources(sources: readonly LintSourceRecordData[]): void {
		for (const source of sources) {
			const directory = dirname(source.relative_path);
			this._directories.set(source.relative_path, directory);
			this._directories.set(source.absolute_path, directory);
			this._directories.set(source.file_name.value(), directory);
			const category = this.category(source.normalized_ast, source.text);
			if (category.length === 0) {
				continue;
			}
			this.increment(directory, category, source.language);
		}
	}

	/** Responsibilities: _unique file category check_. **/
	public category_is_unique(file: string, ast: NormalizedAstFile, language: AstLanguage, text: string): boolean {
		const category = this.category(ast, text);
		if (category.length === 0) {
			return false;
		}
		const index_key = JSON.stringify([language, this.directory(file)]);
		const counts = this._counts.get(index_key);
		if (counts === undefined) {
			return false;
		}
		return counts.get(category) === 1;
	}
}
