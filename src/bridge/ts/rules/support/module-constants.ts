import { basename, dirname, join } from 'node:path';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { AstSourceSpan, NormalizedAstFile } from 'src/types';

/** Responsibilities: _module constants protocol enforcement_. **/
export class ModuleDeclarationsRule {
	private readonly constants_rule: DiagnosticRule = new DiagnosticRule('module-constants-separation');
	private readonly types_rule: DiagnosticRule = new DiagnosticRule('module-types-separation');
	private readonly protocols_rule: DiagnosticRule = new DiagnosticRule('module-protocols-separation');
	private readonly content_rule = new DiagnosticRule('constants-file-content');

	/** Responsibilities: _aggregation constants-file violation misplaced_. **/
	private append_constants_violation(
		violations: Violation[],
		file: string,
		spans: readonly AstSourceSpan[]
	): void {
		if (spans.length === 0 || this.is_constants_file(file)) {
			return;
		}
		const extension = file.endsWith('.py') ? 'py' : 'ts';
		violations.push(this.constants_rule.violation(file, spans[0].start_line + 1, {
			target: join(dirname(file), `constants.${extension}`),
		}));
	}

	/** Responsibilities: _aggregation violation forbidden module_. **/
	private append_content_violation(
		violations: Violation[],
		file: string,
		line: number,
		kind: string
	): void {
		const ext = file.endsWith('.py') ? 'py' : 'ts';
		const parameters = { kind, ext };
		const violation = this.content_rule.violation(file, line, parameters);
		violations.push(violation);
	}

	/** Responsibilities: _aggregation violation directing content_. **/
	private append_move_violation(
		violations: Violation[],
		file: string,
		spans: readonly AstSourceSpan[]
	): void {
		if (spans.length === 0 || basename(file) === 'types.ts' || basename(file) === 'types.py') {
			return;
		}
		const extension = file.endsWith('.py') ? 'py' : 'ts';
		const target = join(dirname(file), `types.${extension}`);
		violations.push(this.types_rule.violation(file, spans[0].start_line + 1, {
			target,
		}));
	}

	/** Responsibilities: _aggregation protocol placement violation_. **/
	private append_protocol_violation(
		violations: Violation[],
		file: string,
		spans: readonly AstSourceSpan[]
	): void {
		if (spans.length === 0 || ['protocols.ts', 'protocols.py'].includes(basename(file))) {
			return;
		}
		const extension = file.endsWith('.py') ? 'py' : 'ts';
		const target = join(dirname(file), `protocols.${extension}`);
		violations.push(this.protocols_rule.violation(file, spans[0].start_line + 1, {
			target,
		}));
	}

	/** Responsibilities: _aggregation diagnostics content forbidden_. **/
	private append_forbidden_content(
		violations: Violation[],
		file: string,
		ast: NormalizedAstFile
	): void {
		if (ast.functions.length > 0) {
			this.append_content_violation(violations, file, ast.functions[0].start + 1, 'function');
		}
		if (ast.classes.length > 0) {
			this.append_content_violation(violations, file, ast.classes[0].start + 1, 'class');
		}
		if (ast.type_declarations.length > 0) {
			this.append_content_violation(violations, file, ast.type_declarations[0].line + 1, 'type');
		}
	}

	/** Responsibilities: _classification file configuration constants_. **/
	private is_constants_file(file: string): boolean {
		const name = basename(file);
		if (name === 'constants.ts') {
			return true;
		}
		return name === 'constants.py';
	}

	/** Responsibilities: _aggregation module-separation moves normalization_. **/
	private append_module_moves(
		violations: Violation[],
		file: string,
		ast: NormalizedAstFile
	): void {
		this.append_constants_violation(violations, file, ast.module_constant_spans);
		this.append_move_violation(violations, file, ast.module_type_spans);
		this.append_protocol_violation(violations, file, ast.module_protocol_spans);
	}

	/** Responsibilities: _aggregation module constants protocol_. **/
	public append(violations: Violation[], file: string, ast: NormalizedAstFile): void {
		if (this.is_constants_file(file)) {
			this.append_forbidden_content(violations, file, ast);
			return;
		}
		const file_name = basename(file);
		if (file_name === 'types.ts' || file_name === 'types.py') {
			return;
		}
		if (['protocols.ts', 'protocols.py'].includes(file_name)) {
			return;
		}
		this.append_module_moves(violations, file, ast);
	}

	/** Responsibilities: _identification files exempt ordinary_. **/
	public special_file(file: string): boolean {
		const name = basename(file);
		return [
			'constants.ts', 'constants.py', 'types.ts',
			'types.py', 'protocols.ts', 'protocols.py',
		].includes(name);
	}

}
