import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TemporalFieldReaderIndex } from "src/linting/orchestration/runtime/typescript-rule-groups/temporal/temporal_field_reader_index";
import { TemporalFieldStateCollector } from "src/linting/orchestration/runtime/typescript-rule-groups/temporal/temporal_field_state_collector";
import type { ViolationContract } from "src/protocols";
import type {
	TemporalCallableState,
	TemporalAppendCallableInput,
	TemporalFieldReaderIndexContract,
	TemporalWriteInput,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";

/** Responsibilities: _field writer analysis_, _temporal coupling diagnostics_. **/
export class TypeScriptTemporalCoupling {
	private readonly source_file: ts.SourceFile;
	private readonly rule: DiagnosticRule;
	private readonly state_collector: TemporalFieldStateCollector;

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
			violations.push(this.rule.violation(
				file,
				this.source_file.getLineAndCharacterOfPosition(callable.node.getStart(this.source_file)).line + 1,
			));
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
		this.source_file = source_file;
		this.rule = new DiagnosticRule("temporal-coupling");
		this.state_collector = new TemporalFieldStateCollector(source_file);
	}

	/** Responsibilities: _class temporal coupling diagnostics_. **/
	public append_class(violations: ViolationContract[], file: string, node: ts.ClassDeclaration): void {
		const initialized = this.state_collector.initialized_fields(node);
		const callables = this.state_collector.callables(node);
		const field_readers = this.field_readers(callables);
		this.append_constructor_fields(callables, initialized);
		for (const index of callables.keys()) {
			this.append_callable({ violations, file, field_readers, initialized, index, callables });
		}
	}

	/** Responsibilities: _source temporal coupling diagnostics_. **/
	public append(violations: ViolationContract[], file: string): void {
		const visit = (node: ts.Node): void => {
			if (ts.isClassDeclaration(node)) {
				this.append_class(violations, file, node);
			}
			node.forEachChild(visit);
		};
		visit(this.source_file);
	}
}
