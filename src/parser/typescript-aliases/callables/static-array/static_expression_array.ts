import type { StaticExpressionArrayContract, StaticExpressionArrayIndex } from "src/analysis_protocols";
import type ts from "typescript";

/** Responsibilities: _lazy static array values_, _indexed expression access_. **/
export class StaticExpressionArray implements StaticExpressionArrayContract {
	private readonly _elements: readonly ts.Expression[];
	private readonly _parts: readonly StaticExpressionArrayContract[];
	private readonly _length: bigint;

	/** Responsibilities: _static array leaf element_. **/
	private leaf_element(index: StaticExpressionArrayIndex): ts.Expression {
		const element = this._elements[Number(index.value)];
		if (element === undefined) {
			throw new Error("Static array leaf is incomplete.");
		}
		return element;
	}

	/** Responsibilities: _static array concatenated element_. **/
	private part_element(index: StaticExpressionArrayIndex): ts.Expression {
		let offset = index.value;
		for (const part of this._parts) {
			if (offset < part.size()) {
				return part.at(offset);
			}
			offset -= part.size();
		}
		throw new Error("Static array index could not be resolved.");
	}

	/** Responsibilities: _static array concatenated suffix_. **/
	private part_suffix(start: number): StaticExpressionArrayContract {
		let offset = BigInt(start);
		const suffix: StaticExpressionArrayContract[] = [];
		for (const part of this._parts) {
			if (offset >= part.size()) {
				offset -= part.size();
				continue;
			}
			const selected = part.slice(Number(offset));
			suffix.push(selected);
			offset = 0n;
		}
		return new StaticExpressionArray([], suffix);
	}

	/** Responsibilities: _static array initialization_. **/
	public constructor(elements: readonly ts.Expression[], parts: readonly StaticExpressionArrayContract[]) {
		this._elements = elements;
		this._parts = parts;
		if (this._elements.length > 0) {
			this._length = BigInt(this._elements.length);
		} else {
			this._length = this._parts.reduce((total, part) => total + part.size(), 0n);
		}
	}

	/** Responsibilities: _static array size lookup_. **/
	public size(): bigint {
		return this._length;
	}

	/** Responsibilities: _static array index membership_. **/
	public contains(index: bigint): boolean {
		return index >= 0n && index < this.size();
	}

	/** Responsibilities: _array index access_. **/
	public at(index: bigint): ts.Expression {
		if (!this.contains(index)) {
			throw new RangeError(`Static array index is out of range: ${String(index)}`);
		}
		if (this._elements.length > 0) {
			return this.leaf_element({ value: index });
		}
		return this.part_element({ value: index });
	}

	/** Responsibilities: _static array suffix view_. **/
	public slice(start: number): StaticExpressionArrayContract {
		if (!Number.isInteger(start) || start < 0) {
			throw new RangeError(`Invalid static array offset: ${start}`);
		}
		if (start === 0) {
			return this;
		}
		if (BigInt(start) >= this.size()) {
			return new StaticExpressionArray([], []);
		}
		if (this._elements.length > 0) {
			const elements = this._elements.slice(start);
			return new StaticExpressionArray(elements, []);
		}
		return this.part_suffix(start);
	}

	/** Responsibilities: _static array materialization_. **/
	public append_to(target: ts.Expression[]): void {
		if (this._elements.length > 0) {
			for (const element of this._elements) {
				target.push(element);
			}
			return;
		}
		for (const part of this._parts) {
			part.append_to(target);
		}
	}
}
