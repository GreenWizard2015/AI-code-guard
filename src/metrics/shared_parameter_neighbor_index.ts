import { MIN_SHARED_METHODS } from "src/constants";
import type {
	SharedParameterLocationPostings,
	SharedParameterNeighborIndexContract,
	SharedParameterNode,
	SharedParameterPairCounts,
} from "src/metrics/types";

/** Responsibilities: _location posting construction_, _qualifying neighbor lookup_. **/
export class SharedParameterNeighborIndex implements SharedParameterNeighborIndexContract {
	private readonly neighbors: ReadonlyMap<number, readonly number[]>;

	/** Responsibilities: _location posting addition_. **/
	private append_location_postings(
		postings: SharedParameterLocationPostings,
		node: SharedParameterNode,
		index: number,
	): void {
		for (const location of node.locations) {
			const key = JSON.stringify([location.file, location.line, location.method]);
			const positions = postings.get(key);
			if (positions === undefined) {
				postings.set(key, [index]);
				continue;
			}
			positions.push(index);
		}
	}

	/** Responsibilities: _posting pair count addition_. **/
	private append_pair_count(pair_counts: SharedParameterPairCounts, left: number, right: number): void {
		let counts = pair_counts.get(left);
		if (counts === undefined) {
			counts = new Map<number, number>();
			pair_counts.set(left, counts);
		}
		const previous = counts.get(right);
		if (previous === undefined) {
			counts.set(right, 1);
			return;
		}
		counts.set(right, previous + 1);
	}

	/** Responsibilities: _posting pair indexing_. **/
	private append_posting_pairs(pair_counts: SharedParameterPairCounts, positions: readonly number[]): void {
		for (let left = 0; left < positions.length; left += 1) {
			const left_index = positions[left];
			if (left_index === undefined) {
				continue;
			}
			for (let right = left + 1; right < positions.length; right += 1) {
				const right_index = positions[right];
				if (right_index === undefined) {
					continue;
				}
				this.append_pair_count(pair_counts, left_index, right_index);
				this.append_pair_count(pair_counts, right_index, left_index);
			}
		}
	}

	/** Responsibilities: _location posting collection_. **/
	private postings(nodes: readonly SharedParameterNode[]): SharedParameterLocationPostings {
		const postings: SharedParameterLocationPostings = new Map();
		for (let index = 0; index < nodes.length; index += 1) {
			const node = nodes[index];
			if (node !== undefined) {
				this.append_location_postings(postings, node, index);
			}
		}
		return postings;
	}

	/** Responsibilities: _qualifying neighbor collection_. **/
	private qualifying_neighbors(pair_counts: SharedParameterPairCounts): ReadonlyMap<number, readonly number[]> {
		const neighbors = new Map<number, number[]>();
		for (const [root, counts] of pair_counts) {
			const count_entries = [...counts.entries()];
			const qualifying_entries = count_entries.filter(([, support]) => support >= MIN_SHARED_METHODS);
			const qualifying = qualifying_entries.map(([index]) => index);
			qualifying.sort((left, right) => left - right);
			neighbors.set(root, qualifying);
		}
		return neighbors;
	}

	/** Responsibilities: _neighbor index construction_. **/
	private build(nodes: readonly SharedParameterNode[]): ReadonlyMap<number, readonly number[]> {
		const pair_counts: SharedParameterPairCounts = new Map();
		for (const positions of this.postings(nodes).values()) {
			this.append_posting_pairs(pair_counts, positions);
		}
		return this.qualifying_neighbors(pair_counts);
	}

	/** Responsibilities: _neighbor index initialization_. **/
	public constructor(neighbors: ReadonlyMap<number, readonly number[]>) {
		this.neighbors = neighbors;
	}

	/** Responsibilities: _neighbor index specialization_. **/
	public with_nodes(nodes: readonly SharedParameterNode[]): SharedParameterNeighborIndexContract {
		return new SharedParameterNeighborIndex(this.build(nodes));
	}

	/** Responsibilities: _root neighbor lookup_. **/
	public for_root(root: number): readonly number[] {
		const neighbors = this.neighbors.get(root);
		if (neighbors === undefined) {
			return [];
		}
		return neighbors;
	}
}
