import ts from 'typescript';

import { TypeScriptCallReferenceCollector } from 'src/parser/ts/typescript-call-references';
import { TypeScriptClassNodes } from 'src/parser/ts/typescript-class-node';
import type {
	AstCallableNode,
	AstClassNode,
	NormalizedAstFile,
} from 'src/types';
import type { TypeScriptSourceResolver } from 'src/model/types';
import type { TypeScriptAstOptions } from 'src/model/types';
import { TypeScriptCallableData } from 'src/model/typescript-callable-data';
import { CallableNodes } from 'src/model/typescript-callable-nodes';
import { TypeScriptAstMetadata } from 'src/model/typescript-ast-metadata';

/** Responsibilities: _TypeScript file parsing_. **/
export class TypeScriptAstFile {
	public readonly source_file: ts.SourceFile;
	private readonly normalized_cache = new Map<string, NormalizedAstFile>();
	private readonly callable_data: TypeScriptCallableData;
	private readonly callable_nodes: CallableNodes;
	private readonly call_reference_collector: TypeScriptCallReferenceCollector;
	private readonly metadata: TypeScriptAstMetadata;
	private readonly class_node_factory: TypeScriptClassNodes;

	/** Responsibilities: _extraction callable nodes top-level_. **/
	private function_nodes_for(statement: ts.Statement): AstCallableNode[] {
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			return [this.callable_nodes.function_declaration_node(statement)];
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return this.callable_nodes.variable_callable_nodes(
			{ source_file: this.source_file },
			statement
		);
	}

	/** Responsibilities: _aggregation callable nodes source-file_. **/
	private append_function_nodes(function_nodes: AstCallableNode[]): void {
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
		const options = provided[0];
		let source_resolver: TypeScriptSourceResolver;
		if (options === undefined) {
			let script_kind = ts.ScriptKind.TS;
			if (file.endsWith('.tsx')) {
				script_kind = ts.ScriptKind.TSX;
			}
			this.source_file = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, script_kind);
			source_resolver = () => [];
		} else {
			this.source_file = options.source_file;
			source_resolver = options.source_resolver;
		}
		this.callable_data = new TypeScriptCallableData(this.source_file);
		this.callable_nodes = new CallableNodes(this.callable_data);
		this.class_node_factory = new TypeScriptClassNodes(this.source_file, this.callable_nodes);
		this.call_reference_collector = new TypeScriptCallReferenceCollector(
			this.source_file,
			source_resolver
		);
		this.metadata = new TypeScriptAstMetadata(this.source_file, this.call_reference_collector);
	}

	/** Responsibilities: _collection normalization class interface_. **/
	public classes(): AstClassNode[] {
		const class_nodes = [
			...this.class_node_factory.class_nodes(),
			...this.class_node_factory.interface_nodes(),
		];
		class_nodes.sort((left, right) => left.start - right.start);
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
		const cached = this.normalized_cache.get('normalized');
		if (cached !== undefined) {
			return cached;
		}
		const classes = this.classes();
		const functions = this.functions();
		const normalized = this.metadata.normalized(classes, functions);
		this.normalized_cache.set('normalized', normalized);
		return normalized;
	}
}
