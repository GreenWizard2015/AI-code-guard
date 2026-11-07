import type {
	UnusedReceiverTypeIndexContract,
	UnusedSymbolReceiverContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import { UnusedReceiverTypeCollector } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_receiver_type_collector";
import ts from "typescript";

/** Responsibilities: _receiver type indexing_, _property receiver resolution_. **/
export class UnusedSymbolReceiver implements UnusedSymbolReceiverContract {
	private readonly _cache: WeakMap<ts.SourceFile, UnusedReceiverTypeIndexContract>;

	/** Responsibilities: _receiver resolver initialization_. **/
	public constructor() {
		this._cache = new WeakMap<ts.SourceFile, UnusedReceiverTypeIndexContract>();
	}

	/** Responsibilities: _receiver type access_. **/
	public type(source_file: ts.SourceFile, receiver: ts.Expression): string {
		if (!ts.isIdentifier(receiver)) {
			return "";
		}
		let index = this._cache.get(source_file);
		if (index === undefined) {
			index = new UnusedReceiverTypeCollector();
			index.collect(source_file);
			this._cache.set(source_file, index);
		}
		return index.type(receiver.text);
	}

	/** Responsibilities: _typed receiver presence_. **/
	public known(source_file: ts.SourceFile, receiver: ts.Expression): boolean {
		return this.type(source_file, receiver).length > 0;
	}
}
