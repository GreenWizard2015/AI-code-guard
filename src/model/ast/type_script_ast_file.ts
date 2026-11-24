import { dirname } from "node:path";
import {
	NORMALIZED_AST_CACHE_KEY,
	TYPESCRIPT_FUNCTIONS_STAGE,
	TYPESCRIPT_METADATA_STAGE_PREFIX,
	TYPESCRIPT_SOURCE_FILE_MISSING_NAME_ERROR,
} from "src/constants";
import ts from "typescript";

import type { CallableNodesContract } from "src/analysis_protocols";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import type { SourceFileResolverContract } from "src/core/project-source/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { CallableNodes } from "src/model/ast/callables/callable_nodes";
import { TypeScriptCallableData } from "src/model/ast/callables/type_script_callable_data";
import { TypeScriptClassNodes } from "src/model/ast/declarations/type_script_class_nodes";
import { TypeScriptAstFileMetadata } from "src/model/ast/metadata/type_script_ast_file_metadata";
import type { AstCallableNode, AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { TypeScriptCallableDataContract } from "src/model/protocols";
import type { TypeScriptAstOptions } from "src/model/types";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptClassNodesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstFileContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _AST syntax tree_, _node hierarchy_. **/

export class TypeScriptAstFile implements TypeScriptAstFileContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _metadata: TypeScriptAstFileMetadata;
	private readonly _class_nodes: TypeScriptClassNodesContract;
	private readonly _normalized_cache: Map<string, NormalizedAstFile>;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _initialization TypeScript AST file_. **/
	public constructor(file: string, text: string);
	/** Responsibilities: _initialization TypeScript AST file_. **/
	public constructor(file: string, text: string, options: TypeScriptAstOptions);
	/** Responsibilities: _initialization source text parser_. **/
	public constructor(file: string, text: string, ...provided: readonly TypeScriptAstOptions[]) {
		const options = provided[0];
		let project_root = dirname(file);
		let source_file: ts.SourceFile;
		let stage_timer: LintStageTimerContract;
		let source_resolver: SourceFileResolverContract;
		let source_io: ProjectSourceIOContract;
		if (options === undefined) {
			let script_kind = ts.ScriptKind.TS;
			if (file.endsWith(".tsx")) {
				script_kind = ts.ScriptKind.TSX;
			}
			source_file = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, script_kind);
			stage_timer = new LintStageTimer();
			const source_file_cache = new SourceFileMapCache();
			source_resolver = source_file_cache.for_map(new Map<string, ts.SourceFile>());
			source_io = new InMemoryProjectSourceIO(new Map());
		} else {
			source_file = options.source_file;
			project_root = options.project_root;
			stage_timer = options.stage_timer;
			source_resolver = options.source_resolver;
			source_io = options.source_io;
		}
		const traversal = stage_timer.measure(
			"startup.project-context.source-records.record-construction.traversal",
			() => {
				if (options === undefined) {
					const traversal = new TypeScriptAstTraversal(source_file);
					traversal.prepare_for_analysis();
					return traversal;
				}
				return options.traversal;
			},
		);
		this._source_file = source_file;
		const callable_data: TypeScriptCallableDataContract = new TypeScriptCallableData(source_file);
		const callable_nodes: CallableNodesContract = new CallableNodes(callable_data, source_file);
		this._class_nodes = new TypeScriptClassNodes(source_file, callable_nodes, traversal);
		this._metadata = new TypeScriptAstFileMetadata(
			{
				source_file,
				project_root,
				stage_timer,
				source_resolver,
				source_io,
				traversal,
			},
			callable_nodes,
			this._class_nodes,
		);
		this._normalized_cache = new Map<string, NormalizedAstFile>();
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _source TypeScript AST access_. **/
	public source_file_node(): ts.SourceFile {
		if (this._source_file.fileName.length === 0) {
			throw new Error(TYPESCRIPT_SOURCE_FILE_MISSING_NAME_ERROR);
		}
		return this._source_file.getSourceFile();
	}

	/** Responsibilities: _class metadata ordering_. **/
	public classes(): AstClassNode[] {
		const classes = this._class_nodes.declaration_nodes();
		classes.sort((left, right) => left.identity.start - right.identity.start);
		return classes;
	}

	/** Responsibilities: _timed callable metadata_. **/
	public functions(): AstCallableNode[] {
		const functions = this._stage_timer.measure(TYPESCRIPT_FUNCTIONS_STAGE, () => this._metadata.functions());
		functions.sort((left, right) => left.identity.start - right.identity.start);
		return functions;
	}

	/** Responsibilities: _construction normalization AST file_. **/
	public normalized(): NormalizedAstFile {
		const cached = this._normalized_cache.get(NORMALIZED_AST_CACHE_KEY);
		if (cached !== undefined) {
			return cached;
		}
		const normalized = this._stage_timer.measure(TYPESCRIPT_METADATA_STAGE_PREFIX, () =>
			this._metadata.normalized_ast(this._stage_timer),
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
