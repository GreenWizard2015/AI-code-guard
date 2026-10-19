import ts from "typescript";
import type { StaticExpressionArrayContract } from "src/protocols";

/** Responsibilities: _lazy static array values_, _indexed expression access_. **/
export class StaticExpressionArray implements StaticExpressionArrayContract {
	private readonly elements: readonly ts.Expression[];
	private readonly parts: readonly StaticExpressionArrayContract[];
	public readonly size: bigint;

	/** Responsibilities: _static array leaf element_. **/
	private leaf_element(index: bigint): ts.Expression {
		const element = this.elements[Number(index)];
		if (element === undefined) {
			throw new Error("Static array leaf is incomplete.");
		}
		return element;
	}

	/** Responsibilities: _static array concatenated element_. **/
	private part_element(index: bigint): ts.Expression {
		let offset = index;
		for (const part of this.parts) {
			if (offset < part.size) {
				return part.at(offset);
			}
			offset -= part.size;
		}
		throw new Error("Static array index could not be resolved.");
	}

	/** Responsibilities: _static array concatenated suffix_. **/
	private part_suffix(start: number): StaticExpressionArrayContract {
		let offset = BigInt(start);
		const suffix: StaticExpressionArrayContract[] = [];
		let suffix_size = 0n;
		for (const part of this.parts) {
			if (offset >= part.size) {
				offset -= part.size;
				continue;
			}
			const selected = part.slice(Number(offset));
			suffix.push(selected);
			suffix_size += selected.size;
			offset = 0n;
		}
		return new StaticExpressionArray([], suffix, suffix_size);
	}

	/** Responsibilities: _static array initialization_. **/
	public constructor(
		elements: readonly ts.Expression[],
		parts: readonly StaticExpressionArrayContract[],
		size: bigint,
	) {
		this.elements = elements;
		this.parts = parts;
		this.size = size;
	}

	/** Responsibilities: _static array index membership_. **/
	public contains(index: bigint): boolean {
		return index >= 0n && index < this.size;
	}

	/** Responsibilities: _array index access_. **/
	public at(index: bigint): ts.Expression {
		if (!this.contains(index)) {
			throw new RangeError(`Static array index is out of range: ${String(index)}`);
		}
		if (this.elements.length > 0) {
			return this.leaf_element(index);
		}
		return this.part_element(index);
	}

	/** Responsibilities: _static array suffix view_. **/
	public slice(start: number): StaticExpressionArrayContract {
		if (!Number.isInteger(start) || start < 0) {
			throw new RangeError(`Invalid static array offset: ${start}`);
		}
		if (start === 0) {
			return this;
		}
		if (BigInt(start) >= this.size) {
			return new StaticExpressionArray([], [], 0n);
		}
		if (this.elements.length > 0) {
			const elements = this.elements.slice(start);
			return new StaticExpressionArray(elements, [], BigInt(elements.length));
		}
		return this.part_suffix(start);
	}

	/** Responsibilities: _static array materialization_. **/
	public append_to(target: ts.Expression[]): void {
		if (this.elements.length > 0) {
			for (const element of this.elements) {
				target.push(element);
			}
			return;
		}
		for (const part of this.parts) {
			part.append_to(target);
		}
	}
}
