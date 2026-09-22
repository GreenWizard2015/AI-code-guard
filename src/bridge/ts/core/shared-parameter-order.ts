import type { CallableLocation, SharedParameterCandidate, SharedParameterNode } from 'src/metrics/types';

/** Responsibilities: _order shared-parameter locations nodes_. **/
export class SharedParameterOrder {
	private readonly reference_kind = 'reference' as const;

	/** Responsibilities: _two text values comparison_. **/
	private compare_text(left: string, right: string): number {
		if (left < right) {
			return -1;
		}
		if (left > right) {
			return 1;
		}
		return 0;
	}

	/** Responsibilities: _shared-parameter kinds stable comparison_. **/
	private compare_node_kinds(left: SharedParameterNode, right: SharedParameterNode): number {
		if (left.kind === right.kind) {
			return 0;
		}
		if (left.kind === this.reference_kind) {
			return -1;
		}
		return 1;
	}

	/** Responsibilities: _callable locations file comparison_. **/
	public compare_locations(left: CallableLocation, right: CallableLocation): number {
		const file_order = this.compare_text(left.file, right.file);
		if (file_order !== 0) {
			return file_order;
		}
		if (left.line !== right.line) {
			return left.line - right.line;
		}
		return this.compare_text(left.method, right.method);
	}

	/** Responsibilities: _output locations shared two_. **/
	public intersect_locations(
		left: readonly CallableLocation[],
		right: readonly CallableLocation[]
	): CallableLocation[] {
		const intersection: CallableLocation[] = [];
		let right_index = 0;
		for (const location of left) {
			while (
				right_index < right.length &&
				this.compare_locations(right[right_index], location) < 0
			) {
				right_index += 1;
			}
			if (right_index >= right.length) {
				break;
			}
			if (this.compare_locations(location, right[right_index]) === 0) {
				intersection.push(location);
			}
		}
		return intersection;
	}

	/** Responsibilities: _shared-parameter nodes kind comparison_. **/
	public compare_nodes(left: SharedParameterNode, right: SharedParameterNode): number {
		const kind_order = this.compare_node_kinds(left, right);
		if (kind_order !== 0) {
			return kind_order;
		}
		return this.compare_text(left.identity, right.identity);
	}

	/** Responsibilities: _shared-parameter candidates their comparison_. **/
	public compare_candidates(
		left: SharedParameterCandidate,
		right: SharedParameterCandidate
	): number {
		if (left.nodes.length !== right.nodes.length) {
			return left.nodes.length - right.nodes.length;
		}
		for (let index = 0; index < left.nodes.length; index += 1) {
			const order = this.compare_nodes(left.nodes[index], right.nodes[index]);
			if (order !== 0) {
				return order;
			}
		}
		return 0;
	}
}
