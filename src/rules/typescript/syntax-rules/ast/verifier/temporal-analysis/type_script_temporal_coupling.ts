import type { TemporalFieldReaderIndexContract } from "src/analysis_protocols";
import type {
	TemporalAppendCallableInput,
	TemporalCallableState,
	TemporalWriteInput,
} from "src/contracts/types/type_script_rule_group_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { TemporalFieldReaderIndex } from "src/rules/typescript/syntax-rules/ast/verifier/temporal-analysis/temporal_field_reader_index";
import { TemporalFieldStateCollector } from "src/rules/typescript/syntax-rules/ast/verifier/temporal-analysis/temporal_field_state_collector";
import type { TypeScriptTemporalCouplingContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _field writer analysis_, _temporal coupling diagnostics_. **/
export class TypeScriptTemporalCoupling implements TypeScriptTemporalCouplingContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _rule: RuleContract;
	private readonly _state_collector: TemporalFieldStateCollector;

	/** Responsibilities: _field reader index construction_. **/
	private field_readers(callables: readonly TemporalCallableState[]): TemporalFieldReaderIndexContract {
		const readers = new TemporalFieldReaderIndex();
		for (const [index, callable] of callables.entries()) {
			for (const field of callable.reads) {
				readers.add(field, index);
			}
		}
		return readers;
	}

	/** Responsibilities: _field mutation reporting_. **/
	private append_callable_writes(input: TemporalWriteInput): void {
		const { violations, file, initialized, callable, index, field_readers } = input;
		for (const field of callable.writes) {
			if (initialized.has(field)) {
				continue;
			}
			if (!field_readers.different_callable_reads(field, index)) {
				continue;
			}
			violations.push(
				this._rule.violation(
					file,
					this._source_file.getLineAndCharacterOfPosition(callable.node.getStart(this._source_file)).line + 1,
					{},
				),
			);
		}
	}

	/** Responsibilities: _callable temporal coupling violations_. **/
	private append_callable(input: TemporalAppendCallableInput): void {
		const { violations, file, field_readers, initialized, index, callables } = input;
		const callable = callables[index];
		if (callable === undefined) {
			return;
		}
		if (callable.node.kind === ts.SyntaxKind.Constructor) {
			for (const field of callable.writes) {
				initialized.add(field);
			}
			return;
		}
		this.append_callable_writes({ violations, file, initialized, callable, index, field_readers });
	}

	/** Responsibilities: _constructor field initialization_. **/
	private append_constructor_fields(callables: readonly TemporalCallableState[], initialized: Set<string>): void {
		for (const callable of callables) {
			if (callable.node.kind !== ts.SyntaxKind.Constructor) {
				continue;
			}
			for (const field of callable.writes) {
				initialized.add(field);
			}
		}
	}

	/** Responsibilities: _temporal coupling analyzer initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._rule = new DiagnosticRule("temporal-coupling");
		this._state_collector = new TemporalFieldStateCollector(source_file);
	}

	/** Responsibilities: _class temporal coupling diagnostics_. **/
	public append_class(violations: ViolationContract[], file: string, node: ts.ClassDeclaration): void {
		const initialized = this._state_collector.initialized_fields(node);
		const callables = this._state_collector.callables(node);
		const field_readers = this.field_readers(callables);
		this.append_constructor_fields(callables, initialized);
		for (const index of callables.keys()) {
			this.append_callable({ violations, file, field_readers, initialized, index, callables });
		}
	}
}
