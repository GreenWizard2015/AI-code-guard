import ts from "typescript";
import { NORMALIZED_AST_CACHE_KEY, TYPESCRIPT_METADATA_STAGE_PREFIX } from "src/constants";
import { dirname } from "node:path";

import { TypeScriptCallReferenceCollector } from "src/model/ast/declarations/type_script_call_reference_collector";
import { TypeScriptClassNodes } from "src/model/ast/declarations/type_script_class_nodes";
import type { AstCallableNodeContract, AstClassNode, NormalizedAstFile } from "src/types";
import type { TypeScriptAstOptions, TypeScriptSourceResolver } from "src/model/types";
import type { CallableNodesContract } from "src/analysis_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptAstMetadataContract, TypeScriptClassNodesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptCallableDataContract, TypeScriptCallReferenceCollectorContract } from "src/model/protocols";
import { TypeScriptCallableData } from "src/model/ast/callables/type_script_callable_data";
import { CallableNodes } from "src/model/ast/callables/callable_nodes";
import { TypeScriptAstMetadata } from "src/model/ast/type_script_ast_metadata";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { EmptySourceText } from "src/io/empty_source_text";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _AST syntax tree_, _node hierarchy_. **/
export class TypeScriptAstFile implements TypeScriptAstFileContract {
	public readonly source_file: ts.SourceFile;
	private readonly normalized_cache: Map<string, NormalizedAstFile>;
	private readonly project_root: string;
	private readonly stage_timer: LintStageTimerContract;
	private readonly source_resolver: TypeScriptSourceResolver;
	private readonly source_io: ProjectSourceIOContract;
	private readonly callable_data: TypeScriptCallableDataContract;
	private readonly callable_nodes: CallableNodesContract;
	private readonly call_reference_collector: TypeScriptCallReferenceCollectorContract;
	private readonly metadata: TypeScriptAstMetadataContract;
	private readonly class_node_factory: TypeScriptClassNodesContract;
	public readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _extraction callable nodes top-level_. **/
	private namespace_function_nodes(statement: ts.Statement): AstCallableNodeContract[] {
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
	private function_nodes_for(statement: ts.Statement): AstCallableNodeContract[] {
		if (ts.isModuleDeclaration(statement)) {
			return this.namespace_function_nodes(statement);
		}
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			return [this.callable_nodes.function_declaration_node(statement)];
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return this.callable_nodes.variable_callable_nodes(statement);
	}

	/** Responsibilities: _aggregation callable nodes source-file_. **/
	private append_function_nodes(function_nodes: AstCallableNodeContract[]): void {
		for (const statement of this.source_file.statements) {
			function_nodes.push(...this.function_nodes_for(statement));
		}
	}

	/** Responsibilities: _initialization TypeScript AST file_. **/
	constructor(file: string, text: string);
	/** Responsibilities: _initialization TypeScript AST file_. **/
	constructor(file: string, text: string, options: TypeScriptAstOptions);
	/** Responsibilities: _initialization source text parser_. **/
	constructor(file: string, text: string, ...provided: readonly TypeScriptAstOptions[]) {
		this.normalized_cache = new Map<string, NormalizedAstFile>();
		const options = provided[0];
		let project_root = dirname(file);
		if (options === undefined) {
			let script_kind = ts.ScriptKind.TS;
			if (file.endsWith(".tsx")) {
				script_kind = ts.ScriptKind.TSX;
			}
			this.source_file = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, script_kind);
		} else {
			this.source_file = options.source_file;
			project_root = options.project_root;
		}
		this.project_root = project_root;
		if (options === undefined) {
			this.stage_timer = new LintStageTimer();
			this.source_resolver = new Map();
			this.source_io = new EmptySourceText();
		} else {
			this.stage_timer = options.stage_timer;
			this.source_resolver = options.source_resolver;
			this.source_io = options.source_io;
		}
		this.callable_data = new TypeScriptCallableData(this.source_file);
		this.callable_nodes = new CallableNodes(this.callable_data, this.source_file);
		this.class_node_factory = new TypeScriptClassNodes(this.source_file, this.callable_nodes);
		const traversal = new TypeScriptAstTraversal(this.source_file);
		this.stage_timer.measure("startup.project-context.source-records.traversal", () => traversal.collect());
		this.traversal = traversal;
		this.call_reference_collector = new TypeScriptCallReferenceCollector({
			source_file: this.source_file,
			project_root: this.project_root,
			stage_timer: this.stage_timer,
			source_files: this.source_resolver,
			traversal,
			source_io: this.source_io,
		});
		this.metadata = new TypeScriptAstMetadata(
			this.source_file,
			this.call_reference_collector,
			this.stage_timer,
			traversal,
		);
	}

	/** Responsibilities: _source TypeScript AST access_. **/
	public source_file_node(): ts.SourceFile {
		if (this.source_file.fileName.length === 0) {
			throw new Error("TypeScript source file has no file name.");
		}
		return this.source_file.getSourceFile();
	}

	/** Responsibilities: _collection normalization class interface_. **/
	public classes(): AstClassNode[] {
		const class_nodes = [...this.class_node_factory.class_nodes(), ...this.class_node_factory.interface_nodes()];
		class_nodes.sort((left, right) => left.start - right.start);
		return class_nodes;
	}

	/** Responsibilities: _collection normalization top-level callable_. **/
	public functions(): AstCallableNodeContract[] {
		const function_nodes: AstCallableNodeContract[] = [];
		this.append_function_nodes(function_nodes);
		return function_nodes;
	}

	/** Responsibilities: _construction normalization AST file_. **/
	public normalized(): NormalizedAstFile {
		const cached = this.normalized_cache.get(NORMALIZED_AST_CACHE_KEY);
		if (cached !== undefined) {
			return cached;
		}
		const classes = this.stage_timer.measure("startup.project-context.source-records.classes", () => this.classes());
		const functions = this.stage_timer.measure("startup.project-context.source-records.functions", () =>
			this.functions(),
		);
		const normalized = this.stage_timer.measure(TYPESCRIPT_METADATA_STAGE_PREFIX, () =>
			this.metadata.normalized(classes, functions),
		);
		this.normalized_cache.set(NORMALIZED_AST_CACHE_KEY, normalized);
		return normalized;
	}

	/** Responsibilities: _AST reference cache_. **/
	public reference_normalization(cached: NormalizedAstFile): NormalizedAstFile {
		this.normalized_cache.set(NORMALIZED_AST_CACHE_KEY, cached);
		return cached;
	}
}
