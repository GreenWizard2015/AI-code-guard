import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { AstClassNode } from 'src/types';

/** Responsibilities: _procedural class names identification_, _naming violations addition_. **/
export class ProceduralClassName {
	private readonly job_title_suffixes = [
		'Manager',
		'Controller',
		'Handler',
		'Processor',
		'Helper',
		'Utils',
		'Utility',
		'Reader',
		'Writer',
		'Parser',
		'Validator',
		'Converter',
		'Sorter',
		'Encoder',
		'Decoder',
		'Router',
		'Dispatcher',
		'Listener',
		'Observer',
		'Runner',
		'Locator',
		'Client',
		'Service',
		'Factory',
		'Builder',
		'Provider',
		'Loader',
		'Fetcher',
		'Resolver',
		'Generator',
		'Calculator',
	] as const;

	/** Responsibilities: _procedural suffix resolution_. **/
	private matching_suffix(name: string): string {
		const suffix = this.job_title_suffixes.find(candidate => name.endsWith(candidate));
		if (suffix === undefined) {
			return '';
		}
		return suffix;
	}

	/** Responsibilities: _class name classification_. **/
	public job_title(name: string): boolean {
		return this.matching_suffix(name).length > 0;
	}

	/** Responsibilities: _aggregation procedural class-name violation_. **/
	public append_violation(violations: Violation[], file: string, node: AstClassNode): void {
		if (!this.job_title(node.name)) {
			return;
		}
		const rule = new DiagnosticRule('procedural-class-name');
		violations.push(rule.violation(file, node.start + 1, { name: node.name }));
	}
}
