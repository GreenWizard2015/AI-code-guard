import { NamingValidation } from 'src/bridge/ts/rules/naming-validation';
import { TestPathSyntax } from 'src/test-path-syntax';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstClassNode, NamedLine, NamedSymbol } from 'src/types';

/** Responsibilities: _classification declaration names visibility_. **/
export class NamingSupport {
	public readonly MAX_NAME_WORDS = 3;
	private readonly external_symbol_names = new Set([
		'unsafeWindow',
		'do_GET',
		'do_OPTIONS',
		'do_POST',
		'GM_xmlhttpRequest',
		'GM_getTab',
		'GM_saveTab',
		'GM_setValue',
		'GM_getValue',
		'MpsTypes',
		'ToolAnnotations',
		'ReQL',
		'addEventListener',
		'removeEventListener',
	]);

	/** Responsibilities: _retrieval normalization declarations lint_. **/
	private source_declarations(
		declarations: NamedLine[],
		classes: AstClassNode[]
	): NamedLine[] {
		if (declarations.length > 0) {
			return declarations;
		}
		return classes.map(node => ({ name: node.name, line: node.start }));
	}

	/** Responsibilities: _aggregation type-name violation named_. **/
	private append_type_violation(
		violations: Violation[],
		file: string,
		declaration: NamedLine
	): void {
		const naming_validation = new NamingValidation();

		const words = naming_validation.name_words(declaration.name);
		if (naming_validation.valid_name(declaration.name, 'type', false, words)) {
			return;
		}
		violations.push(
			naming_validation.naming_violation(file, declaration.line, declaration.name, 'type', words.length)
		);
	}

	/** Responsibilities: _aggregation standard naming violations_. **/
	private append_standard_name(violations: Violation[], file: string, symbol: NamedSymbol): void {
		const naming_validation = new NamingValidation();

		const { name, kind, line } = symbol;
		const is_module_constant = symbol.is_module_constant === true;
		const words = naming_validation.name_words(name);
		if (!naming_validation.valid_name(name, kind, is_module_constant, words)) {
			violations.push(naming_validation.naming_violation(file, line, name, kind, words.length));
		}
	}

	/** Responsibilities: _creation private naming diagnostic_. **/
	private private_name_violation(file: string, symbol: NamedSymbol): Violation {
		let symbol_label = 'module function';
		if (symbol.kind === 'method') {
			symbol_label = 'public method';
		}
		const rule = new DiagnosticRule('naming-private');
		return rule.violation(file, symbol.line + 1, {
			label: symbol_label,
			name: symbol.name,
		});
	}

	/** Responsibilities: _classification symbol usage allowed_. **/
	private has_private_name(
		name: string,
		kind: string,
		is_module_function: boolean,
		visibility: string
	): boolean {
if (!name.startsWith('_') || (name.startsWith('__') && name.endsWith('__'))) {
			return false;
		}
		if (kind === 'function') {
			return is_module_function === true;
		}
		return kind === 'method' && visibility === 'public';
	}

	/** Responsibilities: _classification method externally visible_. **/
	private external_method(
		kind: string,
		name: string,
		line: number,
		classes: AstClassNode[]
	): boolean {
		if (kind !== 'method') {
			return false;
		}
		return classes.some(
			class_node =>
				class_node.extends_external_class &&
				class_node.methods.some(method => method.name === name && method.start === line)
		);
	}

	/** Responsibilities: _aggregation naming violations normalization_. **/
	public append_naming_violations(
		violations: Violation[],
		file: string,
		symbols: NamedSymbol[],
		classes: AstClassNode[],
		type_declarations: NamedLine[]
	): void {
		const test_path_syntax = new TestPathSyntax();

		if (test_path_syntax.test_file(file)) {
			return;
		}
		const declarations = this.source_declarations(type_declarations, classes);
		for (const symbol of symbols) {
			this.append_symbol_violations(violations, file, symbol, classes);
		}
		for (const declaration of declarations) {
			this.append_type_violation(violations, file, declaration);
		}
	}

	/** Responsibilities: _aggregation symbol naming type_. **/
	public append_symbol_violations(
		violations: Violation[],
		file: string,
		symbol: NamedSymbol,
		classes: AstClassNode[]
	): void {
		const { name, kind, line } = symbol;
		const is_module_function = symbol.is_module_function === true;
		const visibility = symbol.visibility;
if (this.external_method(kind, name, line, classes) || this.external_symbol_names.has(name)) {
			return;
		}
		if (this.has_private_name(name, kind, is_module_function, visibility)) {
			violations.push(this.private_name_violation(file, symbol));
			return;
		}
		this.append_standard_name(violations, file, symbol);
	}
}
