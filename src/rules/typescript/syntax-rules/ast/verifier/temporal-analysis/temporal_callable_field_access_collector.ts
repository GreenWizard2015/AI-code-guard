import { TemporalFieldAccessAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/temporal-analysis/temporal_field_access_analysis";
import ts from "typescript";

/** Responsibilities: _field access state_, _field access kinds_. **/
export class TemporalCallableFieldAccessCollector {
	private readonly _callable: ts.Node;
	private readonly _read_names: Set<string>;
	private readonly _written_names: Set<string>;

	/** Responsibilities: _field access collection_. **/
	private append_access(current: ts.Node): void {
		const analysis = new TemporalFieldAccessAnalysis(current);
		const access = analysis.access();
		if (!access.present) {
			return;
		}
		if (access.read) {
			this._read_names.add(access.name);
		}
		if (access.write) {
			this._written_names.add(access.name);
		}
	}

	/** Responsibilities: _callable-local field traversal_. **/
	private visit(current: ts.Node): void {
		if (current !== this._callable && (ts.isFunctionLike(current) || ts.isClassDeclaration(current))) {
			return;
		}
		this.append_access(current);
		current.forEachChild((child) => this.visit(child));
	}

	/** Responsibilities: _field access traversal setup_. **/
	public constructor(callable: ts.Node) {
		this._callable = callable;
		this._read_names = new Set<string>();
		this._written_names = new Set<string>();
	}

	/** Responsibilities: _access results_. **/
	public collect(): void {
		this.visit(this._callable);
	}

	/** Responsibilities: _field access snapshot_. **/
	public field_names_read(): ReadonlySet<string> {
		return this._read_names;
	}

	/** Responsibilities: _field mutation snapshot_. **/
	public field_names_written(): ReadonlySet<string> {
		return this._written_names;
	}
}
