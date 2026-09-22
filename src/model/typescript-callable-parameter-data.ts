import { Syntax } from 'src/syntax';
import ts from 'typescript';

import type { TypedArgument, CallableTypeData } from 'src/model/types';

/** Responsibilities: _extraction TypeScript callable templates_. **/
export class CallableParameterData {
	private readonly source_file: ts.SourceFile;
	private readonly syntax = new Syntax();

	/** Responsibilities: _normalization typed parameter argument_. **/
	private typed_argument(
		parameter: ts.ParameterDeclaration,
		template_names: ReadonlySet<string>
	): TypedArgument[] {
		if (!parameter.type || !ts.isIdentifier(parameter.name)) {
			return [];
		}
		const type = parameter.type.getText(this.source_file);
		let kind = this.syntax.type_kind(parameter.type);
		if (template_names.has(type)) {
			kind = 'template';
		}
		return [{ name: parameter.name.text, type, kind }];
	}

	/** Responsibilities: _collection generic names declared_. **/
	private append_function_templates(names: Set<string>, current: ts.Node): void {
		if (!ts.isFunctionLike(current) || current.typeParameters === undefined) {
			return;
		}
		for (const parameter of current.typeParameters) {
			names.add(parameter.name.text);
		}
	}

	/** Responsibilities: _collection generic names declared_. **/
	private append_class_templates(names: Set<string>, current: ts.Node): void {
		if ((!ts.isClassDeclaration(current)) && (!ts.isClassExpression(current))) {
			return;
		}
		if (current.typeParameters === undefined) {
			return;
		}
		for (const parameter of current.typeParameters) {
			names.add(parameter.name.text);
		}
	}

	/** Responsibilities: _collection generic names visible_. **/
	private template_names(node: ts.SignatureDeclarationBase): ReadonlySet<string> {
		const names = new Set<string>();
		let current: ts.Node | undefined = node;
		while (current !== undefined) {
			this.append_function_templates(names, current);
			this.append_class_templates(names, current);
			current = current.parent;
		}
		return names;
	}

	/** Responsibilities: _collection textual parameter types_. **/
	private parameter_types(node: ts.SignatureDeclarationBase): string[] {
		const types: string[] = [];
		for (const parameter of node.parameters) {
			if (parameter.type && ts.isTypeReferenceNode(parameter.type)) {
				types.push(parameter.type.typeName.getText(this.source_file));
			}
		}
		return types;
	}

	/** Responsibilities: _initialization source file usage_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _collection normalization typed arguments_. **/
	public typed_arguments(node: ts.SignatureDeclarationBase): TypedArgument[] {
		const template_names = this.template_names(node);
		const typed_arguments: TypedArgument[] = [];
		for (const parameter of node.parameters) {
			typed_arguments.push(...this.typed_argument(parameter, template_names));
		}
		return typed_arguments;
	}

	/** Responsibilities: _construction parameter output type_. **/
	public type_data(node: ts.SignatureDeclarationBase): CallableTypeData {
		let return_type = '';
		if (node.type !== undefined) {
			return_type = node.type.getText(this.source_file);
		}
		return {
			parameter_types: this.parameter_types(node),
			return_type,
		};
	}
}
