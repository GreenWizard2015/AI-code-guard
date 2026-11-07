import { MAX_COMPOSITION_DEPTH, MAX_CONSTRUCTOR_DEPENDENCIES, TYPESCRIPT_LANGUAGE } from "src/constants";
import type {
	CompositionChainContract,
	CompositionComponentsContract,
} from "src/contracts/protocols/composition_protocols";
import { CompositionChain } from "src/linting/composition/components/composition_chain";
import { CompositionComponents } from "src/linting/composition/components/composition_components";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ClassGraph, CodeClass } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _composition depth analysis_, _dependency count diagnostics_. **/
export class CompositionAnalyzer {
	private readonly _graph: ClassGraph;
	private readonly _repo_root: string;
	private readonly _components: CompositionComponentsContract;
	private readonly _chain: CompositionChainContract;

	/** Responsibilities: _creation composition-depth violation excessive_. **/
	private depth_violation(current: CodeClass, chain: string[], depth: number): ViolationContract[] {
		if (depth <= MAX_COMPOSITION_DEPTH) {
			return [];
		}
		const rule = new DiagnosticRule("composition-depth");
		return [
			rule.violation(this.relative_file(current.file), current.line + 1, {
				depth: String(chain.length),
				chain: chain.join(" -> "),
			}),
		];
	}

	/** Responsibilities: _constructor dependency count violation_. **/
	private constructor_dependency_violation(current: CodeClass): ViolationContract[] {
		if (current.language === TYPESCRIPT_LANGUAGE) {
			return [];
		}
		const dependencies = new Set(current.dependencies);
		if (dependencies.size <= MAX_CONSTRUCTOR_DEPENDENCIES) {
			return [];
		}
		const rule = new DiagnosticRule("constructor-dependency-count");
		return [
			rule.violation(this.relative_file(current.file), current.line + 1, {
				count: String(dependencies.size),
			}),
		];
	}

	/** Responsibilities: _normalization graph file path_. **/
	private relative_file(file: string): string {
		const prefix = `${this._repo_root}/`;
		if (file.startsWith(prefix)) {
			return file.slice(prefix.length);
		}
		return file;
	}

	/** Responsibilities: _initialization dependency graph repository_. **/
	public constructor(graph: ClassGraph, repo_root: string) {
		this._graph = graph;
		this._repo_root = repo_root;
		this._components = new CompositionComponents(graph);
		this._chain = new CompositionChain(graph);
	}

	/** Responsibilities: _collection composition violations class_. **/
	public class_violations(current_key: string): ViolationContract[] {
		const current = this._graph.classes.get(current_key);
		if (!current) {
			return [];
		}
		const chain = this._chain.chain(current_key);
		return this.depth_violation(current, chain, chain.length);
	}

	/** Responsibilities: _collection composition violations graph_. **/
	public violations(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const current of this._graph.classes.values()) {
			violations.push(...this.constructor_dependency_violation(current));
		}
		for (const component of this._components.source_components()) {
			const representative = this._components.representative(component);
			violations.push(...this.class_violations(representative));
		}
		return violations;
	}
}
