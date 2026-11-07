import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { RuleContextContract } from "src/types";
import { TestPathKind } from "src/types";
import type { TypeScriptTypeOperationsContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";
/** Responsibilities: _type operator classification_, _project type resolution_. **/
export class TypeOperations implements TypeScriptTypeOperationsContract, ASTSourceRuleContract {
	private readonly _utility_names: Set<string>;
	private readonly _operation_names: Map<ts.SyntaxKind, string>;

	/** Responsibilities: _TypeScript type operator mapping_. **/
	private type_operator_operation(operator: ts.SyntaxKind): string {
		if (operator === ts.SyntaxKind.KeyOfKeyword) {
			return "keyof";
		}
		if (operator === ts.SyntaxKind.TypeOfKeyword) {
			return "typeof";
		}
		return "";
	}

	/** Responsibilities: _type operation reference classification_. **/
	private type_reference_operation(node: ts.TypeReferenceNode): string {
		let name = "";
		if (ts.isIdentifier(node.typeName)) {
			name = node.typeName.text;
		} else {
			name = node.typeName.right.text;
		}
		if (this._utility_names.has(name)) {
			return name;
		}
		return "";
	}

	/** Responsibilities: _type parameter reference classification_. **/
	private declaration_type_parameters(declaration: ts.Node): readonly ts.TypeParameterDeclaration[] {
		if (ts.isClassLike(declaration) || ts.isFunctionLike(declaration)) {
			return declaration.typeParameters ?? [];
		}
		if (ts.isTypeAliasDeclaration(declaration)) {
			return declaration.typeParameters ?? [];
		}
		if (ts.isInterfaceDeclaration(declaration)) {
			return declaration.typeParameters ?? [];
		}
		if (ts.isMappedTypeNode(declaration)) {
			return [declaration.typeParameter];
		}
		return [];
	}

	/** Responsibilities: _type parameter lexical ownership_. **/
	private is_type_parameter(reference: ts.Identifier): boolean {
		let declaration: ts.Node | undefined = reference.parent;
		while (declaration !== undefined && !ts.isSourceFile(declaration)) {
			if (this.declaration_type_parameters(declaration).some((parameter) => parameter.name.text === reference.text)) {
				return true;
			}
			declaration = declaration.parent;
		}
		return false;
	}

	/** Responsibilities: _project type reference classification_. **/
	private is_project_type(node: ts.Node, operation: string): boolean {
		if (!ts.isIdentifier(node)) {
			return false;
		}
		if (node.text === operation) {
			return false;
		}
		if (!/^[A-Z_]/u.test(node.text)) {
			return false;
		}
		return !this.is_type_parameter(node);
	}

	/** Responsibilities: _project type reference search_. **/
	private contains_project_type(node: ts.TypeNode, operation: string): boolean {
		let found = false;
		const visit = (child: ts.Node): void => {
			if (this.is_project_type(child, operation)) {
				found = true;
			}
			ts.forEachChild(child, visit);
		};
		ts.forEachChild(node, visit);
		return found;
	}

	/** Responsibilities: _type operation classification_. **/
	private type_operation(node: ts.Node): string {
		if (!ts.isTypeNode(node)) {
			return "";
		}
		if (ts.isIntersectionTypeNode(node) && node.types.every((type) => ts.isTypeReferenceNode(type))) {
			return "";
		}
		if (ts.isTypeReferenceNode(node)) {
			return this.type_reference_operation(node);
		}
		const operation = this._operation_names.get(node.kind);
		if (operation !== undefined) {
			return operation;
		}
		if (!ts.isTypeOperatorNode(node)) {
			return "";
		}
		return this.type_operator_operation(node.operator);
	}

	/** Responsibilities: _type-operation configuration_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._utility_names = new Set([
			"Awaited",
			"ConstructorParameters",
			"Exclude",
			"Extract",
			"InstanceType",
			"NonNullable",
			"NoInfer",
			"Omit",
			"OmitThisParameter",
			"Parameters",
			"Partial",
			"Pick",
			"Readonly",
			"Record",
			"Required",
			"ReturnType",
			"ThisParameterType",
			"ThisType",
		]);
		this._operation_names = new Map<ts.SyntaxKind, string>([
			[ts.SyntaxKind.IndexedAccessType, "indexed access"],
			[ts.SyntaxKind.IntersectionType, "intersection type"],
			[ts.SyntaxKind.ConditionalType, "conditional type"],
			[ts.SyntaxKind.MappedType, "mapped type"],
		]);
	}
	/** Responsibilities: _type-operation diagnostic collection_. **/
	public append_node_operation(node: ts.TypeNode, context: RuleContextContract): void {
		const operation = this.type_operation(node);
		if (operation.length === 0) {
			return;
		}
		if (!this.contains_project_type(node, operation)) {
			return;
		}
		context.for_node(node).append_parameterized_rule(RULE_IDS.typescript_type_operation, { operation });
	}

	/** Responsibilities: _type operation activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _type operation dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (request.context.state().source.path_kinds.has(TestPathKind.TypeScriptTestFile)) {
			return;
		}
		if (!ts.isTypeNode(request.node)) {
			return;
		}
		this.append_node_operation(request.node, request.context);
	}
}
