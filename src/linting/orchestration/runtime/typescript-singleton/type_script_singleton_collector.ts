import ts from "typescript";
import { TypeScriptSingletonExpressions } from "src/linting/orchestration/runtime/typescript-singleton/type_script_singleton_expressions";
import { TypeScriptBlockInstanceCapture } from "src/linting/orchestration/runtime/typescript-singleton/type_script_block_instance_capture";
import type {
	TypeScriptBlockInstanceCaptureContract,
	TypeScriptSingletonCollectorContract,
	TypeScriptSingletonExpressionsContract,
} from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";

/** Responsibilities: _module singleton detection_, _singleton violation reporting_. **/
export class TypeScriptSingletonCollector implements TypeScriptSingletonCollectorContract {
	private readonly file: string;
	private readonly source_file: ts.SourceFile;
	private readonly expressions: TypeScriptSingletonExpressionsContract;
	private readonly block_instances: TypeScriptBlockInstanceCaptureContract;

	/** Responsibilities: _module variable declaration collection_. **/
	private module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[] {
		const declarations = this.block_instances.module_variables(statements);
		const module_names = this.block_instances.module_variable_names(declarations);
		for (const statement of statements) {
			if (ts.isBlock(statement)) {
				declarations.push(...this.block_instances.escaped_variables(statement, module_names));
			}
		}
		return declarations;
	}

	/** Responsibilities: _module assignment collection_. **/
	private module_assignments(statements: readonly ts.Statement[]): ts.BinaryExpression[] {
		const assignments: ts.BinaryExpression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
				return;
			}
			if (ts.isBinaryExpression(node)) {
				if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
					if (ts.isIdentifier(node.left)) {
						assignments.push(node);
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		for (const statement of statements) {
			visit(statement);
		}
		return assignments;
	}

	/** Responsibilities: _variable singleton violations_. **/
	private variable_violations(declarations: readonly ts.VariableDeclaration[]): ViolationContract[] {
		const rule = new DiagnosticRule("singleton");
		return declarations.flatMap((declaration) => {
			if (!this.expressions.variable(declaration)) {
				return [];
			}
			const line = this.source_file.getLineAndCharacterOfPosition(declaration.getStart(this.source_file)).line;
			return [rule.violation(this.file, line + 1)];
		});
	}

	/** Responsibilities: _assignment singleton violations_. **/
	private assignment_violations(assignments: readonly ts.BinaryExpression[]): ViolationContract[] {
		const rule = new DiagnosticRule("singleton");
		return assignments.flatMap((assignment) => {
			if (!this.expressions.initializer(assignment.right)) {
				return [];
			}
			const line = this.source_file.getLineAndCharacterOfPosition(assignment.getStart(this.source_file)).line;
			return [rule.violation(this.file, line + 1)];
		});
	}

	/** Responsibilities: _module export singleton violations_. **/
	private export_violations(): ViolationContract[] {
		const rule = new DiagnosticRule("singleton");
		return this.source_file.statements.flatMap((statement) => {
			if (!ts.isExportAssignment(statement) || !this.expressions.initializer(statement.expression)) {
				return [];
			}
			const line = this.source_file.getLineAndCharacterOfPosition(statement.getStart(this.source_file)).line;
			return [rule.violation(this.file, line + 1)];
		});
	}

	/** Responsibilities: _TypeScript singleton collector initialization_. **/
	public constructor(file: string, source_file: ts.SourceFile, local_class_names: ReadonlySet<string>) {
		this.file = file;
		this.source_file = source_file;
		this.expressions = new TypeScriptSingletonExpressions(source_file, local_class_names);
		this.block_instances = new TypeScriptBlockInstanceCapture(source_file);
	}

	/** Responsibilities: _module variable declarations exposure_. **/
	public variables(): ts.VariableDeclaration[] {
		const declarations = this.module_variables(this.source_file.statements);
		const initialized = declarations.filter((declaration) => declaration.initializer !== undefined);
		return initialized.sort((first, second) => first.getStart(this.source_file) - second.getStart(this.source_file));
	}

	/** Responsibilities: _TypeScript singleton violations collection_. **/
	public collect(): ViolationContract[] {
		const variable_violations = this.variable_violations(this.variables());
		const assignment_violations = this.assignment_violations(this.module_assignments(this.source_file.statements));
		const export_violations = this.export_violations();
		const all_violations = [...variable_violations, ...assignment_violations, ...export_violations];
		all_violations.sort((first, second) => first.line - second.line);
		return all_violations;
	}
}
