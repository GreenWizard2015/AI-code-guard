import type { PythonRuleInput } from "src/linting/types";
import type { AstCallableNode, AstClassNode, NamedLine } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _test production behavior_, _production symbol usage_. **/
export class PythonTestProductionUsage {
	private readonly _functions: AstCallableNode[];
	private readonly _classes: AstClassNode[];
	private readonly _symbol_references: NamedLine[];
	private readonly _production_import_names: ReadonlySet<string>;
	private readonly _violations: ViolationContract[];
	private readonly _file_name: string;
	private readonly _production_usage_rule: RuleContract;

	/** Responsibilities: _production usage rule setup_. **/
	public constructor(input: PythonRuleInput) {
		const { file_name, violations, project, source, operations } = input;
		this._file_name = file_name.value();
		this._violations = violations;
		this._production_import_names = project.production_import_names;
		this._functions = operations.functions;
		this._symbol_references = operations.symbol_references;
		this._classes = source.classes;
		this._production_usage_rule = new DiagnosticRule("test-production-usage");
	}

	/** Responsibilities: _eligible test callable selection_. **/
	public test_callables(): AstCallableNode[] {
		const functions = this._functions.filter(
			(node) => node.identity.name.startsWith("test_") && !node.declaration.decorators.includes("fixture"),
		);
		const methods = this._classes
			.flatMap((node) => node.structure.methods)
			.filter((node) => node.identity.name.startsWith("test_") && !node.declaration.decorators.includes("fixture"));
		return functions.concat(methods);
	}

	/** Responsibilities: _production behavior usage diagnostics_. **/
	public append(test_callables: AstCallableNode[]): void {
		for (const test of test_callables) {
			const used = this._symbol_references.some((reference) => {
				const inside_test = reference.line >= test.identity.start + 1 && reference.line <= test.identity.end + 1;
				return inside_test && this._production_import_names.has(reference.name);
			});
			if (!used) {
				this._violations.push(this._production_usage_rule.violation(this._file_name, test.identity.start + 1, {}));
			}
		}
	}
}
