import { DOCUMENTATION_EXTERNAL_MODULE_ACCESS_MESSAGE } from "documentation_validation/constants";
import type {
	TypeScriptExampleModuleCatalogContract,
	TypeScriptModuleImportPolicyContract,
} from "documentation_validation/protocols";
import { DOCUMENTATION_FUNCTIONS_MODULE_NAME } from "src/constants";
import ts from "typescript";

/** Responsibilities: _module allowlist_, _example import resolution_. **/
export class TypeScriptModuleImportPolicy implements TypeScriptModuleImportPolicyContract {
	private readonly _module_catalog: TypeScriptExampleModuleCatalogContract;
	private readonly _path: string;
	private readonly _source: ts.SourceFile;

	/** Responsibilities: _local module allowlist lookup_. **/
	private local_module_name(name: string): boolean {
		if (name.startsWith(".")) {
			return true;
		}
		if (name.startsWith("src/")) {
			return true;
		}
		if (name.startsWith("tests/")) {
			return true;
		}
		return name === DOCUMENTATION_FUNCTIONS_MODULE_NAME;
	}

	/** Responsibilities: _source module import validation_. **/
	private import_issue(specifier: ts.Expression): string {
		if (!ts.isStringLiteral(specifier)) {
			return `${this._path}: ${DOCUMENTATION_EXTERNAL_MODULE_ACCESS_MESSAGE}`;
		}
		const name = specifier.text;
		if (!this.local_module_name(name)) {
			return `${this._path}: ${DOCUMENTATION_EXTERNAL_MODULE_ACCESS_MESSAGE}`;
		}
		const request = { specifier: name, parent_path: this._path };
		if (name.startsWith("tests/") && this._module_catalog.module(request).length === 0) {
			return `${this._path}: imports must target an example source module`;
		}
		return "";
	}

	/** Responsibilities: _dynamic import validation_. **/
	private dynamic_import_issue(node: ts.CallExpression): string {
		const specifier = node.arguments[0];
		if (specifier === undefined || !ts.isStringLiteral(specifier)) {
			return `${this._path}: dynamic imports require a literal example-module path`;
		}
		const request = { specifier: specifier.text, parent_path: this._path };
		if (this._module_catalog.module(request).length === 0) {
			return `${this._path}: dynamic imports must target an example source module`;
		}
		return "";
	}

	/** Responsibilities: _require call validation_. **/
	private require_issue(node: ts.CallExpression): string {
		const argument = node.arguments[0];
		if (argument === undefined || !ts.isStringLiteral(argument)) {
			return `${this._path}: ${DOCUMENTATION_EXTERNAL_MODULE_ACCESS_MESSAGE}`;
		}
		if (this.local_module_name(argument.text)) {
			return "";
		}
		return `${this._path}: ${DOCUMENTATION_EXTERNAL_MODULE_ACCESS_MESSAGE}`;
	}

	/** Responsibilities: _module import policy setup_. **/
	public constructor(module_catalog: TypeScriptExampleModuleCatalogContract, path: string, source: ts.SourceFile) {
		this._module_catalog = module_catalog;
		this._path = path;
		this._source = source;
	}

	/** Responsibilities: _module access violations_. **/
	public issues(): readonly string[] {
		const issues: string[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isImportDeclaration(node)) {
				issues.push(this.import_issue(node.moduleSpecifier));
			}
			if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
				issues.push(this.import_issue(node.moduleSpecifier));
			}
			if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
				issues.push(this.dynamic_import_issue(node));
			}
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
				issues.push(this.require_issue(node));
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source);
		return issues.filter((issue) => issue.length > 0);
	}
}
