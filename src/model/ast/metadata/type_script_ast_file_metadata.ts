import type { CallableNodesContract } from "src/analysis_protocols";
import { TYPESCRIPT_FUNCTIONS_STAGE, TYPESCRIPT_SOURCE_FILE_MISSING_NAME_ERROR } from "src/constants";
import { TypeScriptCallReferenceCollector } from "src/model/ast/declarations/type_script_call_reference_collector";
import { TypeScriptAstMetadata } from "src/model/ast/metadata/type_script_ast_metadata";
import type { AstCallableNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { TypeScriptCallReferenceCollectorContract } from "src/model/protocols";
import type { TypeScriptAstOptions } from "src/model/types";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptAstMetadataContract, TypeScriptClassNodesContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _AST file callable metadata_, _AST file class metadata_. **/
export class TypeScriptAstFileMetadata {
	private readonly _source_file: ts.SourceFile;
	private readonly _callable_nodes: CallableNodesContract;
	private readonly _metadata: TypeScriptAstMetadataContract;

	/** Responsibilities: _namespace callable extraction_. **/
	private namespace_function_nodes(statement: ts.Statement): AstCallableNode[] {
		if (!ts.isModuleDeclaration(statement)) {
			return [];
		}
		const body = statement.body;
		if (body === undefined || !ts.isModuleBlock(body)) {
			return [];
		}
		return body.statements.flatMap((child) => this.function_nodes_for(child));
	}

	/** Responsibilities: _statement callable extraction_. **/
	private function_nodes_for(statement: ts.Statement): AstCallableNode[] {
		if (ts.isModuleDeclaration(statement)) {
			return this.namespace_function_nodes(statement);
		}
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			return [this._callable_nodes.function_declaration_node(statement)];
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return this._callable_nodes.variable_callable_nodes(statement);
	}

	/** Responsibilities: _AST file metadata assembly_. **/
	public constructor(
		options: TypeScriptAstOptions,
		callable_nodes: CallableNodesContract,
		class_nodes: TypeScriptClassNodesContract,
	) {
		this._source_file = options.source_file;
		this._callable_nodes = callable_nodes;
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const call_reference_collector: TypeScriptCallReferenceCollectorContract = new TypeScriptCallReferenceCollector({
			source_file: this._source_file,
			declaration_index,
			project_root: options.project_root,
			stage_timer: options.stage_timer,
			source_files: options.source_resolver,
			traversal: options.traversal,
			source_io: options.source_io,
		});
		this._metadata = new TypeScriptAstMetadata({
			source_file: this._source_file,
			call_reference_collector,
			stage_timer: options.stage_timer,
			traversal: options.traversal,
			declaration_index,
			class_nodes,
		});
	}

	/** Responsibilities: _source TypeScript AST access_. **/
	public source_file_node(): ts.SourceFile {
		if (this._source_file.fileName.length === 0) {
			throw new Error(TYPESCRIPT_SOURCE_FILE_MISSING_NAME_ERROR);
		}
		return this._source_file.getSourceFile();
	}

	/** Responsibilities: _source callable metadata_. **/
	public functions(): AstCallableNode[] {
		const function_nodes: AstCallableNode[] = [];
		for (const statement of this._source_file.statements) {
			function_nodes.push(...this.function_nodes_for(statement));
		}
		return function_nodes;
	}

	/** Responsibilities: _AST normalization_. **/
	public normalized_ast(stage_timer: LintStageTimerContract): NormalizedAstFile {
		const functions = stage_timer.measure(TYPESCRIPT_FUNCTIONS_STAGE, () => {
			const nodes = this.functions();
			nodes.sort((left, right) => left.identity.start - right.identity.start);
			return nodes;
		});
		return this._metadata.normalized([], functions);
	}
}
