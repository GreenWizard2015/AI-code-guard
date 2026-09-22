import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { ClassGraph, CodeClass } from 'src/types';
import { MAX_COMPOSITION_DEPTH } from 'src/bridge/ts/runner/orchestration/runtime/composition/constants';

/** Responsibilities: _class dependency graph traversal_. **/
export class CompositionAnalyzer {
	private readonly graph: ClassGraph;

	private readonly repo_root: string;

	private readonly incoming: Set<string>;

	/** Responsibilities: _discovery longest dependency chain_. **/
	private find_longest_chain(key: string, visiting: Set<string>): string[] {
		const node = this.graph.classes.get(key);
		if (!node) {
			return [];
		}
		if (visiting.has(node.key)) {
			return [node.name];
		}
		const next_visiting = new Set(visiting);
		next_visiting.add(node.key);
		const longest = this.longest_dependency_chain(node, next_visiting);
		return [node.name, ...longest];
	}

	/** Responsibilities: _dependency paths retention comparison_. **/
	private longest_dependency_chain(node: CodeClass, visiting: Set<string>): string[] {
		let longest: string[] = [];
		for (const dependency of node.dependencies) {
			const candidate = this.find_longest_chain(dependency, visiting);
			if (candidate.length >= longest.length) {
				longest = candidate;
			}
		}
		return longest;
	}

	/** Responsibilities: _creation composition-depth violation excessive_. **/
	private depth_violation(current: CodeClass, chain: string[]): Violation[] {
		if (chain.length <= MAX_COMPOSITION_DEPTH) {
			return [];
		}
		const rule = new DiagnosticRule('composition-depth');
		return [
			rule.violation(this.relative_file(current.file), current.line + 1, {
				depth: String(chain.length),
				chain: chain.join(' -> '),
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
	public constructor(graph: ClassGraph, repo_root: string, incoming: Set<string>) {
		this.graph = graph;
		this.repo_root = repo_root;
		this.incoming = incoming;
	}

	/** Responsibilities: _collection composition violations class_. **/
	public class_violations(current_key: string): Violation[] {
		if (this.incoming.has(current_key)) {
			return [];
		}
		const current = this.graph.classes.get(current_key);
		if (!current) {
			return [];
		}
		const chain = this.find_longest_chain(current_key, new Set());
		return this.depth_violation(current, chain);
	}

	/** Responsibilities: _collection composition violations graph_. **/
	public violations(): Violation[] {
		const violations: Violation[] = [];
		for (const current_key of this.graph.classes.keys()) {
			violations.push(...this.class_violations(current_key));
		}
		return violations;
	}
}
