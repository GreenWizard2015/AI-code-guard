import { dirname } from "node:path";
import { NORMALIZED_AST_CACHE_KEY, TYPESCRIPT_METADATA_STAGE_PREFIX } from "src/constants";
import ts from "typescript";

import type { CallableNodesContract } from "src/analysis_protocols";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { CallableNodes } from "src/model/ast/callables/callable_nodes";
import { TypeScriptCallableData } from "src/model/ast/callables/type_script_callable_data";
import { TypeScriptCallReferenceCollector } from "src/model/ast/declarations/type_script_call_reference_collector";
import { TypeScriptClassNodes } from "src/model/ast/declarations/type_script_class_nodes";
import type { AstCallableNode, AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { TypeScriptAstMetadata } from "src/model/ast/type_script_ast_metadata";
import type { TypeScriptCallReferenceCollectorContract, TypeScriptCallableDataContract } from "src/model/protocols";
import type { TypeScriptAstOptions, TypeScriptSourceResolver } from "src/model/types";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptAstMetadataContract, TypeScriptClassNodesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _AST syntax tree_, _node hierarchy_. **/
export class TypeScriptAstFile implements TypeScriptAstFileContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _normalized_cache: Map<string, NormalizedAstFile>;
	private readonly _project_root: string;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _source_resolver: TypeScriptSourceResolver;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _callable_data: TypeScriptCallableDataContract;
	private readonly _callable_nodes: CallableNodesContract;
	private readonly _call_reference_collector: TypeScriptCallReferenceCollectorContract;
	private readonly _metadata: TypeScriptAstMetadataContract;
	private readonly _class_node_factory: TypeScriptClassNodesContract;

	/** Responsibilities: _extraction callable nodes top-level_. **/
	/** Responsibilities: _namespace callable node extraction_. **/
	private namespace_function_nodes(statement: ts.Statement): AstCallableNode[] {
		if (!ts.isModuleDeclaration(statement)) {
			return [];
		}
		const body = statement.body;
		if (body === undefined) {
			return [];
		}
		if (!ts.isModuleBlock(body)) {
			return [];
		}
		return body.statements.flatMap((child) => this.function_nodes_for(child));
	}

	/** Responsibilities: _extraction callable nodes top-level_. **/
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

	/** Responsibilities: _aggregation callable nodes source-file_. **/
	private append_function_nodes(function_nodes: AstCallableNode[]): void {
		for (const statement of this._source_file.statements) {
			function_nodes.push(...this.function_nodes_for(statement));
		}
	}

	/** Responsibilities: _initialization TypeScript AST file_. **/
	public constructor(file: string, text: string);
	/** Responsibilities: _initialization TypeScript AST file_. **/
	public constructor(file: string, text: string, options: TypeScriptAstOptions);
	/** Responsibilities: _initialization source text parser_. **/
	public constructor(file: string, text: string, ...provided: readonly TypeScriptAstOptions[]) {
		this._normalized_cache = new Map<string, NormalizedAstFile>();
		const options = provided[0];
		let project_root = dirname(file);
		if (options === undefined) {
			let script_kind = ts.ScriptKind.TS;
			if (file.endsWith(".tsx")) {
				script_kind = ts.ScriptKind.TSX;
			}
			this._source_file = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, script_kind);
		} else {
			this._source_file = options.source_file;
			project_root = options.project_root;
		}
		this._project_root = project_root;
		if (options === undefined) {
			this._stage_timer = new LintStageTimer();
			this._source_resolver = new Map();
			this._source_io = new InMemoryProjectSourceIO(new Map());
		} else {
			this._stage_timer = options.stage_timer;
			this._source_resolver = options.source_resolver;
			this._source_io = options.source_io;
		}
		this._callable_data = new TypeScriptCallableData(this._source_file);
		this._callable_nodes = new CallableNodes(this._callable_data, this._source_file);
		this._traversal = this._stage_timer.measure(
			"startup.project-context.source-records.record-construction.traversal",
			() => {
				if (options === undefined) {
					const traversal = new TypeScriptAstTraversal(this._source_file);
					traversal.prepare_for_analysis();
					return traversal;
				}
				return options.traversal;
			},
		);
		this._class_node_factory = new TypeScriptClassNodes(this._source_file, this._callable_nodes, this._traversal);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		this._call_reference_collector = new TypeScriptCallReferenceCollector({
			source_file: this._source_file,
			declaration_index,
			project_root: this._project_root,
			stage_timer: this._stage_timer,
			source_files: this._source_resolver,
			traversal: this._traversal,
			source_io: this._source_io,
		});
		this._metadata = new TypeScriptAstMetadata({
			source_file: this._source_file,
			call_reference_collector: this._call_reference_collector,
			stage_timer: this._stage_timer,
			traversal: this._traversal,
			declaration_index,
			class_nodes: this._class_node_factory,
		});
	}

	/** Responsibilities: _source TypeScript AST access_. **/
	public source_file_node(): ts.SourceFile {
		if (this._source_file.fileName.length === 0) {
			throw new Error("TypeScript source file has no file name.");
		}
		return this._source_file.getSourceFile();
	}

	/** Responsibilities: _class metadata access_. **/
	public classes(): AstClassNode[] {
		const class_nodes = this._class_node_factory.declaration_nodes();
		class_nodes.sort((left, right) => left.identity.start - right.identity.start);
		return class_nodes;
	}

	/** Responsibilities: _collection normalization top-level callable_. **/
	public functions(): AstCallableNode[] {
		const function_nodes: AstCallableNode[] = [];
		this.append_function_nodes(function_nodes);
		return function_nodes;
	}

	/** Responsibilities: _construction normalization AST file_. **/
	public normalized(): NormalizedAstFile {
		const cached = this._normalized_cache.get(NORMALIZED_AST_CACHE_KEY);
		if (cached !== undefined) {
			return cached;
		}
		const classes: AstClassNode[] = [];
		const functions = this._stage_timer.measure(
			"startup.project-context.source-records.record-construction.functions",
			() => this.functions(),
		);
		const normalized = this._stage_timer.measure(TYPESCRIPT_METADATA_STAGE_PREFIX, () =>
			this._metadata.normalized(classes, functions),
		);
		this._normalized_cache.set(NORMALIZED_AST_CACHE_KEY, normalized);
		return normalized;
	}

	/** Responsibilities: _AST reference cache_. **/
	public reference_normalization(cached: NormalizedAstFile): NormalizedAstFile {
		this._normalized_cache.set(NORMALIZED_AST_CACHE_KEY, cached);
		return cached;
	}
}
