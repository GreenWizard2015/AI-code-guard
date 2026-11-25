import { MAX_FILE_LINES, MIN_FILE_LINES, PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import { DirectoryCommentSegments } from "src/core/support/directory_comment_segments";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import { CodeCategoryIndex } from "src/rules/support/code_category_index";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import type { CodeCategoryIndexContract } from "src/rules/support/protocols";
import { TestPathKind } from "src/types";
import type { RuleContextContract, TypeScriptRuleScopeContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _source text analysis_, _file path policy_. **/
export class TypeScriptFileTextRules {
	private readonly _segments: DirectoryCommentSegments;
	private readonly _file_min: DiagnosticRuleContract;
	private readonly _file_max: DiagnosticRuleContract;
	private readonly _non_english: NonEnglishSourceTextRules;
	private readonly _category_indexes: WeakMap<TypeScriptRuleScopeContract, CodeCategoryIndexContract>;

	/** Responsibilities: _code category index selection_. **/
	private category_index(scope: TypeScriptRuleScopeContract): CodeCategoryIndexContract {
		const cached = this._category_indexes.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const index = new CodeCategoryIndex();
		index.index_sources([...scope.source_files(TYPESCRIPT_LANGUAGE), ...scope.source_files(PYTHON_LANGUAGE)]);
		this._category_indexes.set(scope, index);
		return index;
	}

	/** Responsibilities: _file size diagnostics_. **/
	private append_size(
		file: string,
		text: string,
		normalized_ast: NormalizedAstFile,
		scope: TypeScriptRuleScopeContract,
		context: RuleContextContract,
	): void {
		const line_count = text.split("\n").length;
		if (line_count > MAX_FILE_LINES) {
			context.append_violation(this._file_max.violation(file, 1, { count: String(line_count) }));
		}
		const code_lines = this._segments.count_code_lines(text, false, normalized_ast.module_declarations.docstring_spans);
		const categories = this.category_index(scope);
		if (categories.category_is_unique(file, normalized_ast, TYPESCRIPT_LANGUAGE, text)) {
			return;
		}
		if (code_lines < MIN_FILE_LINES) {
			context.append_violation(this._file_min.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _source language diagnostics_. **/
	private append_language(file: string, text: string, test_file: boolean, context: RuleContextContract): void {
		const violations = this._non_english.source_violations({
			file,
			text,
			language: TYPESCRIPT_LANGUAGE,
			test_file,
		});
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}

	/** Responsibilities: _file text rule initialization_. **/
	public constructor() {
		this._segments = new DirectoryCommentSegments("/*", "*/", "#", "//");
		this._file_min = new DiagnosticRule("file-min-size");
		this._file_max = new DiagnosticRule("file-max-size");
		this._non_english = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		this._category_indexes = new WeakMap();
	}

	/** Responsibilities: _test file path diagnostics_. **/
	public append_test_path(request: TypeScriptNodeVerificationRequest): void {
		const {
			source: { file, path_kinds },
		} = request.context.state();
		if (!path_kinds.has(TestPathKind.TestFile) || path_kinds.has(TestPathKind.RootTestsFile)) {
			return;
		}
		const rule = new DiagnosticRule("test-file-location");
		request.context.append_violation(rule.violation(file, 1, {}));
	}

	/** Responsibilities: _source text diagnostics_. **/
	public append_text_rules(request: TypeScriptNodeVerificationRequest): void {
		const { source } = request.context.state();
		const scope = request.context.state().project.rule_scope;
		const text = request.node.getFullText();
		this.append_size(source.file, text, source.normalized_ast, scope, request.context);
		this.append_language(source.file, text, source.test_file, request.context);
	}
}
