import { Syntax } from "src/parser/analysis/syntax";
import ts from "typescript";

import type { CallableParameterDataContract } from "src/model/protocols";
import type { CallableTypeData, TypedArgument } from "src/model/types";

/** Responsibilities: _template parameter resolution_, _callable type extraction_. **/
export class CallableParameterData implements CallableParameterDataContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _syntax: Syntax;

	/** Responsibilities: _normalization typed parameter argument_. **/
	private typed_argument(parameter: ts.ParameterDeclaration, template_names: ReadonlySet<string>): TypedArgument[] {
		if (!parameter.type || !ts.isIdentifier(parameter.name)) {
			return [];
		}
		const type = parameter.type.getText(this._source_file);
		let kind = this._syntax.type_kind(parameter.type);
		if (template_names.has(type)) {
			kind = "template";
		}
		return [{ name: parameter.name.text, type, kind }];
	}

	/** Responsibilities: _collection generic names declared_. **/
	private append_function_templates(names: Set<string>, current: ts.Node): void {
		if (!ts.isFunctionLike(current)) {
			return;
		}
		if (current.typeParameters === undefined) {
			return;
		}
		for (const parameter of current.typeParameters) {
			names.add(parameter.name.text);
		}
	}

	/** Responsibilities: _collection generic names declared_. **/
	private append_class_templates(names: Set<string>, current: ts.Node): void {
		if (!ts.isClassDeclaration(current) && !ts.isClassExpression(current)) {
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
	private template_names(template_callable: ts.SignatureDeclarationBase): ReadonlySet<string> {
		const names = new Set<string>();
		let current: ts.Node | undefined = template_callable;
		while (current !== undefined) {
			this.append_function_templates(names, current);
			this.append_class_templates(names, current);
			current = current.parent;
		}
		return names;
	}

	/** Responsibilities: _collection textual parameter types_. **/
	private parameter_types(type_callable: ts.SignatureDeclarationBase): string[] {
		const types: string[] = [];
		for (const parameter of type_callable.parameters) {
			if (parameter.type && ts.isTypeReferenceNode(parameter.type)) {
				types.push(parameter.type.typeName.getText(this._source_file));
			}
		}
		return types;
	}

	/** Responsibilities: _initialization source file usage_. **/
	public constructor(source_file: ts.SourceFile) {
		this._syntax = new Syntax();
		this._source_file = source_file;
	}

	/** Responsibilities: _collection normalization typed arguments_. **/
	public typed_arguments(argument_callable: ts.SignatureDeclarationBase): TypedArgument[] {
		const template_names = this.template_names(argument_callable);
		const typed_arguments: TypedArgument[] = [];
		for (const parameter of argument_callable.parameters) {
			typed_arguments.push(...this.typed_argument(parameter, template_names));
		}
		return typed_arguments;
	}

	/** Responsibilities: _construction parameter output type_. **/
	public type_data(return_callable: ts.SignatureDeclarationBase): CallableTypeData {
		let return_type = "";
		if (return_callable.type !== undefined) {
			return_type = return_callable.type.getText(this._source_file);
		}
		return {
			parameter_types: this.parameter_types(return_callable),
			return_type,
		};
	}
}
