import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { AstCallableNode } from 'src/types';
import { MAX_CAMEL_WORDS } from 'src/metrics/constants';

/** Responsibilities: _callable naming contracts application_. **/
export class MethodContractRules {
	private readonly result_rules = [
		{ prefixes: ['get'], rule: new DiagnosticRule('method-get-name') },
		{ prefixes: ['find', 'fetch', 'lookup'], rule: new DiagnosticRule('method-find-fetch-lookup-name') },
		{ prefixes: ['load', 'read', 'open'], rule: new DiagnosticRule('method-load-read-open-name') },
		{ prefixes: ['calculate', 'compute'], rule: new DiagnosticRule('method-calculate-compute-name') },
		{ prefixes: ['create', 'build', 'generate'], rule: new DiagnosticRule('method-create-build-generate-name') },
		{ prefixes: ['parse', 'convert', 'transform'], rule: new DiagnosticRule('method-parse-convert-transform-name') },
	] as const;
	private readonly set_rule = new DiagnosticRule('method-set-name');
	private readonly command_rules = [
		{ prefixes: ['process'], rule: new DiagnosticRule('method-process-name') },
		{ prefixes: ['handle'], rule: new DiagnosticRule('method-handle-name') },
		{ prefixes: ['execute', 'perform', 'do'], rule: new DiagnosticRule('method-execute-perform-do-name') },
	] as const;
	private readonly and_rule = new DiagnosticRule('method-and-name');
	private readonly long_rule = new DiagnosticRule('method-long-name');
	private readonly boolean_rules = [
		{ prefixes: ['is'], rule: new DiagnosticRule('boolean-is-name') },
		{ prefixes: ['exists'], rule: new DiagnosticRule('boolean-exists-name') },
		{ prefixes: ['equals'], rule: new DiagnosticRule('boolean-equals-name') },
		{ prefixes: ['has', 'can'], rule: new DiagnosticRule('boolean-has-can-name') },
	] as const;

	/** Responsibilities: _paths identification testing_. **/
	private test_file(file: string): boolean {
		const normalized_file = file.replaceAll('\\', '/');
if (normalized_file.startsWith('tests/') || normalized_file.includes('/tests/')) {
			return true;
		}
if (normalized_file.endsWith('.test.ts') || normalized_file.endsWith('.spec.ts')) {
			return true;
		}
return normalized_file.endsWith('_test.py') || normalized_file.endsWith('_test.ts');
	}

	/** Responsibilities: _verb prefixes matching_. **/
	private starts_with(name: string, prefixes: readonly string[]): boolean {
		for (const prefix of prefixes) {
			if (name.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _name word count_. **/
	private method_words(name: string): number {
		if (name.startsWith('__') && name.endsWith('__')) {
			return 0;
		}
		if (name.startsWith('_')) {
			name = name.slice(1);
		}
		if (name.includes('_')) {
			return name.split('_').filter(Boolean).length;
		}
		return this.camel_case_words(name);
	}

	/** Responsibilities: _camel-case word count_. **/
	private camel_case_words(name: string): number {
		let count = 0;
		const tokens = name.match(/\p{Lu}+(?=\p{Lu}\p{Ll}|$)|\p{Lu}\p{Ll}*|\p{Ll}+|\d+/gu);
		if (tokens !== null) {
			count = tokens.length;
		}
		return count;
	}

	/** Responsibilities: _result naming violations addition_. **/
	private append_result_rules(violations: Violation[], file: string, node: AstCallableNode): void {
if (node.return_type === 'boolean' || node.return_type === 'bool') {
			return;
		}
		for (const group of this.result_rules) {
			if (this.starts_with(node.name, group.prefixes)) {
				violations.push(group.rule.violation(file, node.start + 1, { name: node.name }));
				return;
			}
		}
	}

	/** Responsibilities: _setter violation addition_. **/
	private append_set_rule(violations: Violation[], file: string, node: AstCallableNode): void {
		if (this.starts_with(node.name, ['set'])) {
			violations.push(this.set_rule.violation(file, node.start + 1, { name: node.name }));
		}
	}

	/** Responsibilities: _command violations addition_. **/
	private append_command_rules(violations: Violation[], file: string, node: AstCallableNode): void {
		for (const group of this.command_rules) {
			if (this.starts_with(node.name, group.prefixes)) {
				violations.push(group.rule.violation(file, node.start + 1, { name: node.name }));
				return;
			}
		}
	}

	/** Responsibilities: _compound naming violations addition_. **/
	private append_compound_rules(violations: Violation[], file: string, node: AstCallableNode): void {
if (node.name.includes('_and_') || /[a-z]And[A-Z]/u.test(node.name)) {
			violations.push(this.and_rule.violation(file, node.start + 1, { name: node.name }));
		}
		if (this.method_words(node.name) > MAX_CAMEL_WORDS) {
			violations.push(this.long_rule.violation(file, node.start + 1, { name: node.name }));
		}
	}

	/** Responsibilities: _boolean violations addition_. **/
	private append_boolean_rules(violations: Violation[], file: string, node: AstCallableNode): void {
if (node.return_type !== 'boolean' && node.return_type !== 'bool') {
			return;
		}
		for (const group of this.boolean_rules) {
			if (this.starts_with(node.name, group.prefixes)) {
				violations.push(group.rule.violation(file, node.start + 1, { name: node.name }));
				return;
			}
		}
	}

	/** Responsibilities: _private callable contracts application_. **/
	private append_private_node(violations: Violation[], file: string, node: AstCallableNode): void {
		if (!file.endsWith('.py')) {
			return;
		}
		if (!node.name.startsWith('_')) {
			return;
		}
		if (node.name.startsWith('__') && node.name.endsWith('__')) {
			return;
		}
		this.append_compound_rules(violations, file, node);
	}

	/** Responsibilities: _public naming contracts application_. **/
	private append_public_node(violations: Violation[], file: string, node: AstCallableNode): void {
		this.append_result_rules(violations, file, node);
		this.append_set_rule(violations, file, node);
		this.append_command_rules(violations, file, node);
		this.append_compound_rules(violations, file, node);
		this.append_boolean_rules(violations, file, node);
	}

	/** Responsibilities: _callable naming routing_. **/
	public append_node(violations: Violation[], file: string, node: AstCallableNode): void {
		if (this.test_file(file)) {
			return;
		}
		if (node.name.startsWith('test_')) {
			return;
		}
		if (node.owner === '' || node.visibility !== 'public') {
			this.append_private_node(violations, file, node);
			return;
		}
		this.append_public_node(violations, file, node);
	}

	/** Responsibilities: _file naming contracts application_. **/
	public append(violations: Violation[], file: string, nodes: readonly AstCallableNode[]): void {
		for (const node of nodes) {
			this.append_node(violations, file, node);
		}
	}
}
