import ts from 'typescript';
import { TestPathSyntax } from 'src/test-path-syntax';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
/** Responsibilities: _classification TypeScript type operators_. **/
export class TypeOperations {
	private readonly utility_names = new Set([
		'Awaited', 'ConstructorParameters', 'Exclude', 'Extract', 'InstanceType',
		'NonNullable', 'NoInfer', 'Omit', 'OmitThisParameter', 'Parameters',
		'Partial', 'Pick', 'Readonly', 'Record', 'Required', 'ReturnType',
		'ThisParameterType', 'ThisType',
	]);
	private readonly operation_names = new Map<ts.SyntaxKind, string>([
		[ts.SyntaxKind.IndexedAccessType, 'indexed access'],
		[ts.SyntaxKind.IntersectionType, 'intersection type'],
		[ts.SyntaxKind.ConditionalType, 'conditional type'],
		[ts.SyntaxKind.MappedType, 'mapped type'],
	]);

	/** Responsibilities: _aggregation type-operation diagnostics AST_. **/
	private append_node_operation(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.Node
	): void {
		const operation = this.type_operation(node);
if (operation.length === 0 || !this.contains_project_type(node, operation)) {
			return;
		}
		this.append_operation_violation(violations, file, source_file, node, operation);
	}

	/** Responsibilities: _aggregation diagnostic disallowed type_. **/
	private append_operation_violation(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.Node,
		operation: string
	): void {
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		const rule = new DiagnosticRule('typescript-type-operation');
		violations.push(rule.violation(file, line, { operation }));
	}

	/** Responsibilities: _TypeScript type operator mapping_. **/
	private type_operator_operation(operator: ts.SyntaxKind): string {
		if (operator === ts.SyntaxKind.KeyOfKeyword) {
			return 'keyof';
		}
		if (operator === ts.SyntaxKind.TypeOfKeyword) {
			return 'typeof';
		}
		return '';
	}

	/** Responsibilities: _classification operations represented type_. **/
	private type_reference_operation(node: ts.Node): string {
		if (!ts.isTypeReferenceNode(node)) {
			return '';
		}
		if (!ts.isIdentifier(node.typeName)) {
			return '';
		}
		if (this.utility_names.has(node.typeName.text)) {
			return node.typeName.text;
		}
		return '';
	}

	/** Responsibilities: _classification type operation references_. **/
	private contains_project_type(node: ts.Node, operation: string): boolean {
		let found = false;
		const visit = (child: ts.Node): void => {
if (ts.isIdentifier(child) && child.text !== operation && /^[A-Z_]/u.test(child.text)) {
				found = true;
			}
			ts.forEachChild(child, visit);
		};
		ts.forEachChild(node, visit);
		return found;
	}

	/** Responsibilities: _resolution type-operation kind AST_. **/
	public type_operation(node: ts.Node): string {
if (ts.isIntersectionTypeNode(node) && node.types.every(type => ts.isTypeReferenceNode(type))) {
			return '';
		}
		const type_reference = this.type_reference_operation(node);
		if (type_reference.length > 0) {
			return type_reference;
		}
		const operation = this.operation_names.get(node.kind);
		if (operation !== undefined) {
			return operation;
		}
		if (ts.isTypeOperatorNode(node)) {
			return this.type_operator_operation(node.operator);
		}
		return '';
	}

	/** Responsibilities: _aggregation disallowed type-operation violations_. **/
	public append_type_ops(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		const test_path_syntax = new TestPathSyntax();

		if (test_path_syntax.test_ts(file)) {
			return;
		}
		const visit = (node: ts.Node): void => {
			this.append_node_operation(violations, file, source_file, node);
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}

}
