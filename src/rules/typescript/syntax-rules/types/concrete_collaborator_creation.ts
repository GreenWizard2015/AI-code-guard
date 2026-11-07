import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { TypeScriptCollaboratorTypeIndex } from "src/rules/typescript/syntax-rules/types/type_script_collaborator_type_index";
import { TypeScriptCollaboratorTypeUsage } from "src/rules/typescript/syntax-rules/types/type_script_collaborator_type_usage";
import type {
	TypeScriptCollaboratorTypeIndexContract,
	TypeScriptNameMap,
} from "src/rules/typescript/syntax-rules/types/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _per-operation collaborator detection_, _contract index lifecycle_. **/
export class ConcreteCollaboratorCreation implements ASTSourceRuleContract {
	private readonly _contract_indexes: WeakMap<ts.SourceFile, TypeScriptCollaboratorTypeIndexContract>;

	/** Responsibilities: _nearest method ownership_. **/
	private owner(creation_candidate: ts.Node): ts.Node {
		let current = creation_candidate.parent;
		while (current !== undefined) {
			if (ts.isMethodDeclaration(current)) {
				return current;
			}
			if (ts.isConstructorDeclaration(current) || ts.isFunctionLike(current)) {
				return creation_candidate.getSourceFile();
			}
			current = current.parent;
		}
		return creation_candidate.getSourceFile();
	}

	/** Responsibilities: _shadowed constructor detection_. **/
	private shadowed(
		creation_expression: ts.NewExpression,
		owning_method: ts.MethodDeclaration,
		candidate_class_name: string,
	): boolean {
		for (const parameter of owning_method.parameters) {
			if (ts.isIdentifier(parameter.name) && parameter.name.text === candidate_class_name) {
				return true;
			}
		}
		let current = creation_expression.parent;
		while (current !== undefined && current !== owning_method) {
			if (ts.isBlock(current)) {
				const shadow = this.block_declares(current, candidate_class_name);
				if (shadow) {
					return true;
				}
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _block-scoped name lookup_. **/
	private block_declares(scope_block: ts.Block, block_class_name: string): boolean {
		for (const statement of scope_block.statements) {
			const declarations = this.statement_declares(statement, block_class_name);
			if (declarations) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _single statement binding detection_. **/
	private statement_declares(statement: ts.Statement, statement_class_name: string): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found || this.is_nested_scope(node, statement)) {
				return;
			}
			if (this.declares_name(node, statement_class_name)) {
				found = true;
				return;
			}
			node.forEachChild(visit);
		};
		visit(statement);
		return found;
	}

	/** Responsibilities: _nested lexical scope classification_. **/
	private is_nested_scope(node: ts.Node, statement: ts.Statement): boolean {
		if (node === statement) {
			return false;
		}
		return ts.isBlock(node) || ts.isFunctionLike(node) || ts.isClassLike(node);
	}

	/** Responsibilities: _declaration name match_. **/
	private declares_name(declaration_candidate: ts.Node, declared_class_name: string): boolean {
		if (ts.isVariableDeclaration(declaration_candidate) && ts.isIdentifier(declaration_candidate.name)) {
			return declaration_candidate.name.text === declared_class_name;
		}
		if (ts.isFunctionDeclaration(declaration_candidate) || ts.isClassDeclaration(declaration_candidate)) {
			if (declaration_candidate.name !== undefined) {
				return declaration_candidate.name.text === declared_class_name;
			}
		}
		return false;
	}

	/** Responsibilities: _method collaborator diagnosis_. **/
	private append_method_creation(
		method_creation: ts.NewExpression,
		contracts: TypeScriptNameMap,
		collaborator_class: string,
		context: RuleContextContract,
	): void {
		const owning_method = this.owner(method_creation);
		if (!ts.isMethodDeclaration(owning_method)) {
			return;
		}
		if (this.shadowed(method_creation, owning_method, collaborator_class)) {
			return;
		}
		const usage = new TypeScriptCollaboratorTypeUsage(
			context.state().source.source_file,
			context,
			owning_method,
			contracts,
		);
		usage.prepare();
		if (usage.uses(method_creation)) {
			context.for_node(method_creation).append_rule(RULE_IDS.concrete_collaborator_created_per_operation);
		}
	}

	/** Responsibilities: _single collaborator creation analysis_. **/
	private append_creation(creation_candidate: ts.NewExpression, context: RuleContextContract): void {
		if (!ts.isIdentifier(creation_candidate.expression)) {
			return;
		}
		const collaborator_class = creation_candidate.expression.text;
		const source_file = context.state().source.source_file;
		let contract_index = this._contract_indexes.get(source_file);
		if (contract_index === undefined) {
			contract_index = new TypeScriptCollaboratorTypeIndex(source_file, context);
			contract_index.prepare();
			this._contract_indexes.set(source_file, contract_index);
		}
		const contracts = contract_index.for_class(collaborator_class);
		if (contracts.size === 0) {
			return;
		}
		this.append_method_creation(creation_candidate, contracts, collaborator_class, context);
	}

	/** Responsibilities: _contract analysis cache initialization_. **/
	public constructor() {
		this._contract_indexes = new WeakMap();
	}

	/** Responsibilities: _collaborator rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _collaborator creation node dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!request.context.state().source.test_file && ts.isNewExpression(request.node)) {
			this.append_creation(request.node, request.context);
		}
	}
}
