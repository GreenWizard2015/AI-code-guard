import ts from 'typescript';
import type { AstCallableReference } from 'src/types';
import type { TypeScriptReferenceContext } from 'src/typescript-reference-context';
import type { CallReferenceOptions } from 'src/bridge/ts/parser/types';

/** Responsibilities: _construction normalization TypeScript function_. **/
export class TypeScriptCallReference {
	private readonly method_kind = 'method' as const;

	/** Responsibilities: _optional owner caller addition_. **/
	private add_reference_context(
		reference: AstCallableReference,
		options: CallReferenceOptions
	): void {
		if (options.is_bound) {
			return;
		}
		if (options.current_owner) {
			reference.caller_owner = options.current_owner;
		}
		if (options.is_call) {
			reference.is_call = true;
		}
	}

	/** Responsibilities: _calculation one-based source line_. **/
	private reference_line(source_file: ts.SourceFile, expression: ts.Node): number {
		const position = expression.getStart(source_file);
		const location = source_file.getLineAndCharacterOfPosition(position);
		return location.line;
	}

	/** Responsibilities: _selection first populated reference_. **/
	private reference_options(option_values: CallReferenceOptions[]): CallReferenceOptions {
		if (option_values[0] !== undefined) {
			return option_values[0];
		}
		return { current_owner: '', is_bound: false, is_call: false };
	}

	/** Responsibilities: _construction normalization function reference_. **/
	private function_reference(
		context: TypeScriptReferenceContext,
		expression: ts.Identifier,
		line: number
	): AstCallableReference {
		return {
			name: context.function_name(expression),
			kind: 'function',
			owner: '',
			caller_owner: '',
			is_call: false,
			dynamic: false,
			line,
		};
	}

	/** Responsibilities: _construction normalization method reference_. **/
	public method_reference(
		context: TypeScriptReferenceContext,
		expression: ts.PropertyAccessExpression,
		line: number,
		options: CallReferenceOptions
	): AstCallableReference {
		const reference: AstCallableReference = {
			name: expression.name.text,
			kind: this.method_kind,
			owner: context.method_owner(expression, options.current_owner),
			caller_owner: '',
			is_call: false,
			dynamic: false,
			line,
		};
		this.add_reference_context(reference, options);
		return reference;
	}

	/** Responsibilities: _construction normalization invocation reference_. **/
	public call_reference(
		source_file: ts.SourceFile,
		context: TypeScriptReferenceContext,
		expression: ts.Node,
		...option_values: CallReferenceOptions[]
	): AstCallableReference {
		const reference_options = this.reference_options(option_values);
		const line = this.reference_line(source_file, expression);
		if (ts.isIdentifier(expression)) {
			return this.function_reference(context, expression, line);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.method_reference(context, expression, line, reference_options);
		}
		throw new Error('Unsupported TypeScript call reference expression.');
	}
}
