import type { WorkerModuleReferences } from "src/core/project-source/types";
import type { WorkerEntryPathRequest, WorkerUrlPathsContract } from "src/core/project-source/types";
import ts from "typescript";

/** Responsibilities: _Worker import names_, _Worker constructor paths_. **/
export class WorkerModuleReferenceScan {
	private readonly _source_file: ts.SourceFile;
	private readonly _url_paths: WorkerUrlPathsContract;
	private readonly _worker_names: Set<string>;
	private readonly _paths_by_field: Map<string, readonly string[]>;
	private readonly _constructions: ts.NewExpression[];

	/** Responsibilities: _Worker import alias collection_. **/
	private collect_worker_names(): void {
		for (const statement of this._source_file.statements) {
			const specifiers = this.worker_named_imports(statement);
			for (const element of specifiers) {
				const imported_name = element.propertyName;
				if ((imported_name ?? element.name).text === "Worker") {
					this._worker_names.add(element.name.text);
				}
			}
		}
	}

	/** Responsibilities: _Worker module import bindings_. **/
	private worker_named_imports(statement: ts.Statement): readonly ts.ImportSpecifier[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return [];
		}
		const module_name = statement.moduleSpecifier.text;
		if (module_name !== "node:worker_threads" && module_name !== "worker_threads") {
			return [];
		}
		return this.worker_import_bindings(statement);
	}

	/** Responsibilities: _Worker import specifiers_. **/
	private worker_import_bindings(statement: ts.ImportDeclaration): readonly ts.ImportSpecifier[] {
		const import_clause = statement.importClause;
		if (import_clause === undefined) {
			return [];
		}
		const bindings = import_clause.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements;
	}

	/** Responsibilities: _Worker constructor reference collection_. **/
	private collect_node_references(): void {
		const pending: ts.Node[] = [this._source_file];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined) {
				continue;
			}
			this.collect_node_reference(node);
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
	}

	/** Responsibilities: _Worker reference node classification_. **/
	private collect_node_reference(node: ts.Node): void {
		if (ts.isBinaryExpression(node)) {
			this.collect_worker_field(node);
		}
		if (ts.isNewExpression(node)) {
			this.collect_worker_construction(node);
		}
	}

	/** Responsibilities: _Worker URL field collection_. **/
	private collect_worker_field(expression: ts.BinaryExpression): void {
		if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return;
		}
		if (!this.this_property_assignment(expression.left)) {
			return;
		}
		if (!ts.isPropertyAccessExpression(expression.left)) {
			return;
		}
		const request: WorkerEntryPathRequest = { expression: expression.right, source_file: this._source_file };
		const paths = this._url_paths.entry_paths(request);
		if (paths.length > 0) {
			const field = expression.left.name.text;
			const existing = this._paths_by_field.get(field) ?? [];
			this._paths_by_field.set(field, [...new Set([...existing, ...paths])]);
		}
	}

	/** Responsibilities: _Worker instance field classification_. **/
	private this_property_assignment(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		return expression.expression.kind === ts.SyntaxKind.ThisKeyword;
	}

	/** Responsibilities: _Worker constructor matching_. **/
	private collect_worker_construction(expression: ts.NewExpression): void {
		if (!ts.isIdentifier(expression.expression)) {
			return;
		}
		if (this._worker_names.has(expression.expression.text)) {
			this._constructions.push(expression);
		}
	}

	/** Responsibilities: _Worker constructor URL selection_. **/
	private construction_paths(worker: ts.NewExpression): readonly string[] {
		const arguments_list = worker.arguments;
		if (arguments_list === undefined) {
			return [];
		}
		const argument = arguments_list.at(0);
		if (argument === undefined) {
			return [];
		}
		const request: WorkerEntryPathRequest = { expression: argument, source_file: this._source_file };
		const direct_paths = this._url_paths.entry_paths(request);
		if (direct_paths.length > 0) {
			return direct_paths;
		}
		return this.field_paths(argument);
	}

	/** Responsibilities: _Worker constructor field paths_. **/
	private field_paths(argument: ts.Expression): readonly string[] {
		if (!ts.isPropertyAccessExpression(argument)) {
			return [];
		}
		if (argument.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return [];
		}
		return this._paths_by_field.get(argument.name.text) ?? [];
	}

	/** Responsibilities: _Worker source initialization_. **/
	public constructor(source_file: ts.SourceFile, url_paths: WorkerUrlPathsContract) {
		this._source_file = source_file;
		this._url_paths = url_paths;
		this._worker_names = new Set();
		this._paths_by_field = new Map();
		this._constructions = [];
	}

	/** Responsibilities: _Worker import presence_. **/
	public worker_import_present(): boolean {
		this.collect_worker_names();
		return this._worker_names.size > 0;
	}

	/** Responsibilities: _Worker module reference index_. **/
	public references(): WorkerModuleReferences {
		this._worker_names.clear();
		this._paths_by_field.clear();
		this._constructions.length = 0;
		this.collect_worker_names();
		if (this._worker_names.size > 0) {
			this.collect_node_references();
		}
		const paths: string[] = [];
		for (const worker of this._constructions) {
			paths.push(...this.construction_paths(worker));
		}
		return {
			worker_names: this._worker_names,
			paths_by_field: new Map(this._paths_by_field),
			constructions: this._constructions,
			module_paths: paths,
		};
	}
}
