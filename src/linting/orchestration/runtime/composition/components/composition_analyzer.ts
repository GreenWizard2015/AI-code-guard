import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type { ClassGraph, CodeClass } from "src/model/types/types";
import { MAX_COMPOSITION_DEPTH, MAX_CONSTRUCTOR_DEPENDENCIES } from "src/constants";
import { CompositionComponents } from "src/linting/orchestration/runtime/composition/components/composition_components";
import { CompositionChain } from "src/linting/orchestration/runtime/composition/components/composition_chain";
import type {
	CompositionChainContract,
	CompositionComponentsContract,
} from "src/linting/orchestration/runtime/composition/protocols";

/** Responsibilities: _composition depth analysis_, _dependency count diagnostics_. **/
export class CompositionAnalyzer {
	private readonly graph: ClassGraph;
	private readonly repo_root: string;
	private readonly components: CompositionComponentsContract;
	private readonly chain: CompositionChainContract;

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
		const prefix = `${this.repo_root}/`;
		if (file.startsWith(prefix)) {
			return file.slice(prefix.length);
		}
		return file;
	}

	/** Responsibilities: _initialization dependency graph repository_. **/
	public constructor(graph: ClassGraph, repo_root: string) {
		this.graph = graph;
		this.repo_root = repo_root;
		this.components = new CompositionComponents(graph);
		this.chain = new CompositionChain(graph);
	}

	/** Responsibilities: _collection composition violations class_. **/
	public class_violations(current_key: string): ViolationContract[] {
		const current = this.graph.classes.get(current_key);
		if (!current) {
			return [];
		}
		const chain = this.chain.chain(current_key);
		return this.depth_violation(current, chain, chain.length);
	}

	/** Responsibilities: _collection composition violations graph_. **/
	public violations(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const current of this.graph.classes.values()) {
			violations.push(...this.constructor_dependency_violation(current));
		}
		for (const component of this.components.source_components()) {
			const representative = this.components.representative(component);
			violations.push(...this.class_violations(representative));
		}
		return violations;
	}
}
