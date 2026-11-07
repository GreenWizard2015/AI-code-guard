import { PlatformSourceImportScope } from "src/rules/typescript/syntax-rules/callables/platform_source_import_scope";
import type {
	ModuleNamespaceImportsContract,
	PlatformApiDetectionContract,
	PlatformApiDetectorDependencies,
	PlatformSourceImportScopeContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _platform API call detection_, _adapter namespace detection_. **/
export class PlatformApiDetector implements PlatformApiDetectionContract {
	private readonly _namespace_imports: ModuleNamespaceImportsContract;
	private readonly _imports_by_source: WeakMap<ts.SourceFile, PlatformSourceImportScopeContract>;

	/** Responsibilities: _source platform import scope_. **/
	private import_scope(source_file: ts.SourceFile): PlatformSourceImportScopeContract {
		const cached = this._imports_by_source.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const imports = new PlatformSourceImportScope();
		imports.index(source_file);
		this._imports_by_source.set(source_file, imports);
		return imports;
	}

	/** Responsibilities: _platform API cache ownership_. **/
	public constructor(dependencies: PlatformApiDetectorDependencies) {
		this._namespace_imports = dependencies.module_namespace_imports;
		this._imports_by_source = new WeakMap<ts.SourceFile, PlatformSourceImportScopeContract>();
	}

	/** Responsibilities: _module namespace import lookup_. **/
	public module_namespace_imports(): ModuleNamespaceImportsContract {
		return this._namespace_imports;
	}

	/** Responsibilities: _platform API call classification_. **/
	public platform_call(call: ts.Node): boolean {
		if (!ts.isCallExpression(call)) {
			return false;
		}
		return this.import_scope(call.getSourceFile()).node_api_call(call);
	}

	/** Responsibilities: _platform adapter call classification_. **/
	public platform_adapter_call(call: ts.Node): boolean {
		if (!ts.isCallExpression(call)) {
			return false;
		}
		const method = call.expression;
		if (!ts.isPropertyAccessExpression(method)) {
			return false;
		}
		const receiver = method.expression;
		if (!ts.isPropertyAccessExpression(receiver) || receiver.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		return this.import_scope(call.getSourceFile()).adapter_member(call, receiver.name.text);
	}
}
