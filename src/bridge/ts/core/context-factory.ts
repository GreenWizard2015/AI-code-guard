import ts from 'typescript';
import { ContextSourceRecordSet } from 'src/bridge/ts/core/context/context-source-record-factory';
import { TypeScriptSourceFiles } from 'src/bridge/ts/core/context/typescript-source-files';
import { PythonSourceFiles } from 'src/bridge/ts/core/context/python-source-files';
import { SourceText } from 'src/rules/typescript/default-source-loader';
import type { LintProjectContext } from 'src/protocols';
import { LintProjectContextStore } from 'src/bridge/ts/core/project-context';
import type { NormalizedAstFile } from 'src/types';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';

/** Responsibilities: _source text parsing_. **/
export class LintProjectContextCreator {
	private readonly source_record_factory = new ContextSourceRecordSet();
	private readonly source_text = new SourceText();
	private readonly python_ast_parser: PythonAstData;

	/** Responsibilities: _source text measurement_. **/
	private timed_source_texts(files: string[], stage_timer: LintStageTimer): Map<string, string> {
		return stage_timer.measure(
			'startup.project-context.read-files',
			() => this.source_texts(files)
		);
	}

	/** Responsibilities: _TypeScript source parsing_. **/
	private timed_source_files(
		files: string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimer
	): Map<string, ts.SourceFile> {
		return stage_timer.measure(
			'startup.project-context.typescript-source-files',
			() => {
				const source_files = new TypeScriptSourceFiles(files, texts);
				return source_files.source_files();
			}
		);
	}

	/** Responsibilities: _Python batch parsing_. **/
	private python_file_asts(
		files: string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimer
	): ReadonlyMap<string, NormalizedAstFile> {
		return stage_timer.measure(
			'startup.project-context.python-bridge',
			() => {
				const source_files = new PythonSourceFiles(files, texts, this.python_ast_parser);
				return source_files.source_ast();
			}
		);
	}

	/** Responsibilities: _initialization reusable Python AST_. **/
	public constructor(...parsers: PythonAstData[]) {
		if (parsers.length === 0) {
			this.python_ast_parser = new PythonAstData();
		} else {
			this.python_ast_parser = parsers[0];
		}
	}

	/** Responsibilities: _construction complete project context_. **/
	public lint_context(
		repo_root: string,
		files: string[],
		stage_timer: LintStageTimer
	): LintProjectContext {
		const texts = this.timed_source_texts(files, stage_timer);
		const source_files = this.timed_source_files(files, texts, stage_timer);
		const python_file_asts = this.python_file_asts(files, texts, stage_timer);
		const sources = stage_timer.measure(
			'startup.project-context.source-records',
			() => this.source_record_factory.source_records(
				repo_root,
				files,
				texts,
				source_files,
				python_file_asts
			)
		);
		const statistics = this.source_record_factory.statistics(files, source_files);
		return stage_timer.measure(
			'startup.project-context.context-store',
			() => new LintProjectContextStore(sources, statistics)
		);
	}

	/** Responsibilities: _source text configuration_. **/
	public source_texts(files: string[]): Map<string, string> {
		const texts = new Map<string, string>();
		for (const file of files) {
			texts.set(file, this.source_text.source_text(file));
		}
		return texts;
	}
}
