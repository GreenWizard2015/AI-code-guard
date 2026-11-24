import {
	DOCUMENTATION_CLI_FILE_NAME,
	DOCUMENTATION_CONSOLE_NAME,
	DOCUMENTATION_HOST_MODULE_LOADER_MESSAGE,
	DOCUMENTATION_OUTPUT_METHOD_NAMES,
	TYPESCRIPT_CONTEXT_MODULE_KEY,
	TYPESCRIPT_CONTEXT_REQUIRE_KEY,
} from "documentation_validation/constants";
import type { TypeScriptRuntimeCapabilityPolicyContract } from "documentation_validation/protocols";
import ts from "typescript";

/** Responsibilities: _runtime capability allowlist_, _source output boundary_. **/
export class TypeScriptRuntimeCapabilityPolicy implements TypeScriptRuntimeCapabilityPolicyContract {
	private readonly _path: string;
	private readonly _source: ts.SourceFile;
	private readonly _forbidden_globals: ReadonlySet<string>;
	private readonly _entrypoint: boolean;

	/** Responsibilities: _host loader identification_. **/
	private module_loader_access(computed_access: ts.ElementAccessExpression): boolean {
		if (!ts.isIdentifier(computed_access.expression)) {
			return false;
		}
		return computed_access.expression.text === TYPESCRIPT_CONTEXT_REQUIRE_KEY;
	}

	/** Responsibilities: _computed property validation_. **/
	private dynamic_property(computed_access: ts.ElementAccessExpression): string {
		if (this.module_loader_access(computed_access)) {
			return `${this._path}: computed module-loader access is not allowed`;
		}
		const key = computed_access.argumentExpression;
		if (key === undefined) {
			return "";
		}
		if (ts.isStringLiteral(key) || ts.isNumericLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return "";
		}
		return `${this._path}: dynamic property access is not allowed`;
	}

	/** Responsibilities: _host property loader recognition_. **/
	private host_property_issue(property_access: ts.PropertyAccessExpression): string {
		if (!ts.isIdentifier(property_access.expression)) {
			return "";
		}
		if (property_access.expression.text !== TYPESCRIPT_CONTEXT_MODULE_KEY) {
			return "";
		}
		if (property_access.name.text !== TYPESCRIPT_CONTEXT_REQUIRE_KEY) {
			return "";
		}
		return `${this._path}: ${DOCUMENTATION_HOST_MODULE_LOADER_MESSAGE}`;
	}

	/** Responsibilities: _host indexed loader recognition_. **/
	private host_indexed_issue(indexed_access: ts.ElementAccessExpression): string {
		if (!ts.isIdentifier(indexed_access.expression)) {
			return "";
		}
		if (indexed_access.expression.text !== TYPESCRIPT_CONTEXT_MODULE_KEY) {
			return "";
		}
		const property = indexed_access.argumentExpression;
		if (!ts.isStringLiteral(property)) {
			return "";
		}
		if (property.text !== TYPESCRIPT_CONTEXT_REQUIRE_KEY) {
			return "";
		}
		return `${this._path}: ${DOCUMENTATION_HOST_MODULE_LOADER_MESSAGE}`;
	}

	/** Responsibilities: _top-level output validation_. **/
	private top_level_output(call_expression: ts.CallExpression, inside_callable: boolean): string {
		if (!ts.isPropertyAccessExpression(call_expression.expression)) {
			return "";
		}
		const target = call_expression.expression;
		if (!ts.isIdentifier(target.expression) || target.expression.text !== DOCUMENTATION_CONSOLE_NAME) {
			return "";
		}
		if (!DOCUMENTATION_OUTPUT_METHOD_NAMES.has(target.name.text)) {
			return "";
		}
		if (this._entrypoint || inside_callable) {
			return "";
		}
		return `${this._path}: imported modules must write output from a called function or method`;
	}

	/** Responsibilities: _global capability diagnostics_. **/
	private append_global_issue(issues: string[], identifier: ts.Identifier): void {
		if (this._forbidden_globals.has(identifier.text)) {
			issues.push(`${this._path}: access to ${identifier.text} is not allowed`);
		}
		if (this._entrypoint && identifier.text === DOCUMENTATION_CONSOLE_NAME) {
			issues.push(`${this._path}: CLI entrypoints must not write output`);
		}
	}

	/** Responsibilities: _runtime capability policy setup_. **/
	public constructor(path: string, source: ts.SourceFile, forbidden_globals: ReadonlySet<string>) {
		this._path = path;
		this._source = source;
		this._forbidden_globals = forbidden_globals;
		this._entrypoint = path.endsWith(DOCUMENTATION_CLI_FILE_NAME);
	}

	/** Responsibilities: _runtime capability violations_. **/
	public issues(): readonly string[] {
		const issues: string[] = [];
		const visit = (node: ts.Node, inside_callable: boolean): void => {
			if (ts.isIdentifier(node)) {
				this.append_global_issue(issues, node);
			}
			if (ts.isPropertyAccessExpression(node)) {
				issues.push(this.host_property_issue(node));
			}
			if (ts.isElementAccessExpression(node)) {
				issues.push(this.dynamic_property(node));
				issues.push(this.host_indexed_issue(node));
			}
			if (ts.isCallExpression(node)) {
				issues.push(this.top_level_output(node, inside_callable));
			}
			let nested_callable = inside_callable;
			if (ts.isFunctionLike(node)) {
				nested_callable = true;
			}
			ts.forEachChild(node, (child) => visit(child, nested_callable));
		};
		visit(this._source, false);
		return issues.filter((issue) => issue.length > 0);
	}
}
