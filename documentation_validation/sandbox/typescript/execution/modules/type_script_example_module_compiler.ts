import type { DocumentationExampleSourceFile } from "documentation_validation/types";
import ts from "typescript";

/** Responsibilities: _documentation test syntax adaptation_, _virtual module transpilation_. **/
export class TypeScriptExampleModuleCompiler {
	private readonly _matcher_names: ReadonlyMap<string, string>;

	/** Responsibilities: _expectation call identification_. **/
	private expectation_call(expression: ts.Expression): boolean {
		if (!ts.isCallExpression(expression)) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		return expression.expression.text === "expect";
	}

	/** Responsibilities: _Jest API member adaptation_. **/
	private api_member(receiver: ts.Expression, member: string): string {
		if (member === "spyOn" && ts.isIdentifier(receiver) && receiver.text === "jest") {
			return "spy_on";
		}
		if (this.expectation_call(receiver)) {
			const replacement = this._matcher_names.get(member);
			if (replacement !== undefined) {
				return replacement;
			}
		}
		return "";
	}

	/** Responsibilities: _documentation test syntax adaptation_. **/
	private test_source_transformer(): ts.TransformerFactory<ts.SourceFile> {
		return (context) => (root) => {
			const visit: ts.Visitor = (node) => {
				if (ts.isPropertyAccessExpression(node)) {
					const replacement = this.api_member(node.expression, node.name.text);
					if (replacement.length > 0) {
						return ts.factory.updatePropertyAccessExpression(
							node,
							node.expression,
							ts.factory.createIdentifier(replacement),
						);
					}
				}
				return ts.visitEachChild(node, visit, context);
			};
			return ts.visitEachChild(root, visit, context);
		};
	}

	/** Responsibilities: _test source formatting_. **/
	private print_test_source(source: ts.SourceFile): string {
		const transformed = ts.transform(source, [this.test_source_transformer()]);
		let output = source.text;
		try {
			for (const transformed_source of transformed.transformed) {
				output = ts.createPrinter().printFile(transformed_source);
			}
		} finally {
			transformed.dispose();
		}
		return output;
	}

	/** Responsibilities: _nested require argument transformation_. **/
	private exported_module_call(
		node: ts.CallExpression,
		visit: ts.Visitor,
		module_source: DocumentationExampleSourceFile,
	): ts.Expression {
		for (const specifier of node.arguments) {
			let visited_specifier = specifier;
			const transformed_specifier = ts.visitNode(specifier, visit, ts.isExpression);
			if (transformed_specifier !== undefined) {
				visited_specifier = transformed_specifier;
			}
			const request = ts.factory.createObjectLiteralExpression([
				ts.factory.createPropertyAssignment("specifier", visited_specifier),
				ts.factory.createPropertyAssignment("parent_path", ts.factory.createStringLiteral(module_source.path)),
			]);
			const module_record = ts.factory.createCallExpression(
				ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("require"), "module_record"),
				undefined,
				[request],
			);
			return ts.factory.createPropertyAccessExpression(module_record, "exports");
		}
		return node;
	}

	/** Responsibilities: _virtual module require transformation_. **/
	private module_require_transformer(
		module_source: DocumentationExampleSourceFile,
	): ts.TransformerFactory<ts.SourceFile> {
		return (context) => {
			const visit: ts.Visitor = (node) => {
				if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
					return this.exported_module_call(node, visit, module_source);
				}
				return ts.visitEachChild(node, visit, context);
			};
			return (root) => ts.visitEachChild(root, visit, context);
		};
	}

	/** Responsibilities: _compiler matcher configuration_. **/
	public constructor(matcher_names: ReadonlyMap<string, string>) {
		this._matcher_names = matcher_names;
	}

	/** Responsibilities: _documentation test source adaptation_. **/
	public adapted_test_source(source_file: DocumentationExampleSourceFile): string {
		const path_segments = source_file.path.replaceAll("\\", "/").split("/");
		if (!path_segments.includes("tests")) {
			return source_file.text;
		}
		const source = ts.createSourceFile(
			source_file.path,
			source_file.text,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		return this.print_test_source(source);
	}

	/** Responsibilities: _module transpilation_. **/
	public emitted_source(source_file: DocumentationExampleSourceFile): string {
		const adapted_text = this.adapted_test_source(source_file);
		const emitted = ts.transpileModule(adapted_text, {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
			fileName: source_file.path,
			transformers: { after: [this.module_require_transformer(source_file)] },
		}).outputText;
		return emitted.replace(/^#![^\r\n]*(?:\r?\n|$)/u, "");
	}
}
