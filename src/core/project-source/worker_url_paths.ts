import type {
	WorkerEntryPathRequest,
	WorkerUrlPathAlternatives,
	WorkerUrlPathsContract,
} from "src/core/project-source/types";
import ts from "typescript";

/** Responsibilities: _Worker URL paths_, _static path alternatives_. **/
export class WorkerUrlPaths implements WorkerUrlPathsContract {
	private readonly _alternatives_by_expression: WorkerUrlPathAlternatives;

	/** Responsibilities: _selector call name lookup_. **/
	private selector_name(expression: ts.CallExpression): string {
		if (ts.isIdentifier(expression.expression)) {
			return expression.expression.text;
		}
		if (ts.isPropertyAccessExpression(expression.expression)) {
			if (expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
				return expression.expression.name.text;
			}
		}
		return "";
	}

	/** Responsibilities: _selector body URL paths_. **/
	private selector_body_paths(body: ts.Block): readonly string[] {
		const paths: string[] = [];
		const pending: ts.Node[] = [body];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			if (ts.isReturnStatement(node) && node.expression !== undefined) {
				paths.push(...this.paths(node.expression));
				continue;
			}
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
		return paths;
	}

	/** Responsibilities: _function selector URL paths_. **/
	private function_return_paths(function_entry: WorkerEntryPathRequest, function_name: string): readonly string[] {
		const paths: string[] = [];
		for (const statement of function_entry.source_file.statements) {
			if (!ts.isFunctionDeclaration(statement)) {
				continue;
			}
			const declaration_name = statement.name;
			if (declaration_name === undefined || declaration_name.text !== function_name) {
				continue;
			}
			if (statement.body !== undefined) {
				paths.push(...this.selector_body_paths(statement.body));
			}
		}
		return paths;
	}

	/** Responsibilities: _method selector URL paths_. **/
	private method_body_paths(
		member: ts.MethodDeclaration,
		member_method_name: string,
		source_file: ts.SourceFile,
	): readonly string[] {
		if (member.name.getText(source_file) !== member_method_name) {
			return [];
		}
		if (member.body === undefined) {
			return [];
		}
		return this.selector_body_paths(member.body);
	}

	/** Responsibilities: _class method lookup_. **/
	private class_selector_paths(method_entry: WorkerEntryPathRequest, selector_method_name: string): readonly string[] {
		const paths: string[] = [];
		for (const statement of method_entry.source_file.statements) {
			if (!ts.isClassDeclaration(statement)) {
				continue;
			}
			for (const member of statement.members) {
				if (!ts.isMethodDeclaration(member)) {
					continue;
				}
				paths.push(...this.method_body_paths(member, selector_method_name, method_entry.source_file));
			}
		}
		return paths;
	}

	/** Responsibilities: _static path alternative lookup_. **/
	private cached_paths(candidate: ts.Expression): readonly string[] {
		const cached = this._alternatives_by_expression.get(candidate);
		if (cached !== undefined) {
			return cached;
		}
		const paths = this.calculate_paths(candidate);
		this._alternatives_by_expression.set(candidate, paths);
		return paths;
	}

	/** Responsibilities: _Worker URL argument lookup_. **/
	private url_argument(url_construction: ts.Expression): ts.Expression {
		if (!ts.isNewExpression(url_construction)) {
			return url_construction;
		}
		if (!ts.isIdentifier(url_construction.expression) || url_construction.expression.text !== "URL") {
			return url_construction;
		}
		const arguments_list = url_construction.arguments;
		if (arguments_list === undefined) {
			return url_construction;
		}
		const argument = arguments_list.at(0);
		if (argument === undefined) {
			return url_construction;
		}
		return argument;
	}

	/** Responsibilities: _conditional Worker URL paths_. **/
	private conditional_paths(expression: ts.ConditionalExpression): readonly string[] {
		const when_true = this.cached_paths(expression.whenTrue);
		const when_false = this.cached_paths(expression.whenFalse);
		return [...when_true, ...when_false];
	}

	/** Responsibilities: _static path expression analysis_. **/
	private calculate_paths(node: ts.Expression): readonly string[] {
		if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			return [node.text];
		}
		if (ts.isParenthesizedExpression(node)) {
			return this.cached_paths(node.expression);
		}
		if (ts.isBinaryExpression(node)) {
			return this.binary_paths(node);
		}
		if (ts.isTemplateExpression(node)) {
			return this.template_paths(node);
		}
		if (ts.isConditionalExpression(node)) {
			return this.conditional_paths(node);
		}
		return [];
	}

	/** Responsibilities: _path concatenation alternatives_. **/
	private binary_paths(binary_expression: ts.BinaryExpression): readonly string[] {
		if (binary_expression.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
			return [];
		}
		const prefixes = this.cached_paths(binary_expression.left);
		const suffixes = this.cached_paths(binary_expression.right);
		if (suffixes.length === 0) {
			return prefixes;
		}
		const paths: string[] = [];
		for (const prefix of prefixes) {
			for (const suffix of suffixes) {
				paths.push(`${prefix}${suffix}`);
			}
		}
		return paths;
	}

	/** Responsibilities: _template path alternatives_. **/
	private template_paths(template_expression: ts.TemplateExpression): readonly string[] {
		let path = template_expression.head.text;
		for (const span of template_expression.templateSpans) {
			path += span.literal.text;
		}
		return [path];
	}

	/** Responsibilities: _path cache initialization_. **/
	public constructor() {
		this._alternatives_by_expression = new WeakMap();
	}

	/** Responsibilities: _Worker URL path alternatives_. **/
	public paths(expression: ts.Expression): readonly string[] {
		const argument = this.url_argument(expression);
		return this.cached_paths(argument);
	}

	/** Responsibilities: _Worker entry URL alternatives_. **/
	public entry_paths(request: WorkerEntryPathRequest): readonly string[] {
		const paths = this.paths(request.expression);
		if (paths.length > 0) {
			return paths;
		}
		if (!ts.isCallExpression(request.expression)) {
			return paths;
		}
		const name = this.selector_name(request.expression);
		const function_paths = this.function_return_paths(request, name);
		const method_paths = this.class_selector_paths(request, name);
		return [...function_paths, ...method_paths];
	}
}
