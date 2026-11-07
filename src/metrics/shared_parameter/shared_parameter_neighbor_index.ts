import { MIN_SHARED_METHODS } from "src/constants";
import { SharedParameterPairCountMap } from "src/metrics/types";
import type {
	SharedParameterLocationPostings,
	SharedParameterNeighborIndexContract,
	SharedParameterNode,
	SharedParameterPairCounts,
} from "src/metrics/types";

/** Responsibilities: _shared-parameter neighbor graph_, _qualifying neighbor index_. **/
export class SharedParameterNeighborIndex implements SharedParameterNeighborIndexContract {
	private readonly _pair_counts: SharedParameterPairCounts;
	private readonly _neighbors: Map<number, readonly number[]>;

	/** Responsibilities: _location posting insertion_. **/
	private append_location_postings(
		postings: SharedParameterLocationPostings,
		node: SharedParameterNode,
		index: number,
	): void {
		for (const location of node.locations) {
			const location_parts = [location.file, location.line, location.method];
			const key = JSON.stringify(location_parts);
			const positions = postings.get(key);
			if (positions === undefined) {
				postings.set(key, [index]);
				continue;
			}
			positions.push(index);
		}
	}

	/** Responsibilities: _pair support count_. **/
	private append_pair(left_index: number, right_index: number): void {
		let counts = this._pair_counts.get(left_index);
		if (counts === undefined) {
			counts = new SharedParameterPairCountMap();
			this._pair_counts.set(left_index, counts);
		}
		counts.add_support(right_index);
	}

	/** Responsibilities: _shared-location pair support_. **/
	private append_location_pairs(positions: readonly number[]): void {
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
				this.append_pair(left_index, right_index);
				this.append_pair(right_index, left_index);
			}
		}
	}

	/** Responsibilities: _qualifying neighbor selection_. **/
	private append_qualifying_neighbors(): void {
		for (const [root, counts] of this._pair_counts) {
			const qualifying: number[] = [];
			for (const index of counts.keys()) {
				if (counts.meets_threshold(index, MIN_SHARED_METHODS)) {
					qualifying.push(index);
				}
			}
			qualifying.sort((left, right) => left - right);
			this._neighbors.set(root, qualifying);
		}
	}

	/** Responsibilities: _neighbor index construction_. **/
	private index_shared_locations(nodes: readonly SharedParameterNode[]): void {
		const postings: SharedParameterLocationPostings = new Map();
		for (let index = 0; index < nodes.length; index += 1) {
			const node = nodes[index];
			if (node !== undefined) {
				this.append_location_postings(postings, node, index);
			}
		}
		for (const positions of postings.values()) {
			this.append_location_pairs(positions);
		}
		this.append_qualifying_neighbors();
	}

	/** Responsibilities: _neighbor index initialization_. **/
	public constructor() {
		this._pair_counts = new Map();
		this._neighbors = new Map();
	}

	/** Responsibilities: _shared-parameter neighbor graph update_. **/
	public prepare(nodes: readonly SharedParameterNode[]): void {
		this._pair_counts.clear();
		this._neighbors.clear();
		this.index_shared_locations(nodes);
	}

	/** Responsibilities: _root neighbor lookup_. **/
	public for_root(root: number): readonly number[] {
		const neighbors = this._neighbors.get(root);
		if (neighbors === undefined) {
			return [];
		}
		return neighbors;
	}
}
