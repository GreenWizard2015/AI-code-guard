import { PYTHON_TESTCASE_BASE, PYTHON_UNITTEST_FRAMEWORK } from "src/constants";
import { PythonTestFrameworkIdentity } from "src/linting/orchestration/runtime/test-targets/python_test_framework_identity";
import type { AstClassNode, NormalizedAstSource } from "src/model/ast/normalized_ast_types";
import type { PythonTestFramework } from "src/model_types";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _Python test-file declarations_, _test framework classification_. **/
export class PythonTestFileDeclarations {
	private readonly _declarations: NormalizedAstSource;
	private readonly _identity: PythonTestFrameworkIdentity;

	/** Responsibilities: _test declaration ownership_. **/
	public constructor(source: LintSourceRecordData) {
		this._declarations = source.normalized_ast.source;
		this._identity = new PythonTestFrameworkIdentity(
			source.normalized_ast.references.reference_aliases,
			source.normalized_ast.source.python_imports,
		);
	}

	/** Responsibilities: _test class selection_. **/
	public test_classes(): AstClassNode[] {
		return this._declarations.classes.filter((node) =>
			node.structure.methods.some(
				(method) => method.identity.name.startsWith("test_") && !method.declaration.decorators.includes("fixture"),
			),
		);
	}

	/** Responsibilities: _test declaration detection_. **/
	public contains_tests(): boolean {
		if (this._declarations.functions.some((node) => node.identity.name.startsWith("test_"))) {
			return true;
		}
		return this.test_classes().length > 0;
	}

	/** Responsibilities: _test framework classification_. **/
	public framework(): PythonTestFramework {
		for (const node of this.test_classes()) {
			if (node.structure.base_class_names.some((name) => this._identity.resolve(name) === PYTHON_TESTCASE_BASE)) {
				return PYTHON_UNITTEST_FRAMEWORK;
			}
		}
		return "pytest";
	}
}
