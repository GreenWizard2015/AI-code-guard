import ts from "typescript";
import type { CyrillicCommentText } from "src/bridge/ts/rules/types";

/** Responsibilities: _standalone string comment analysis_. **/
export class StandaloneStringComments {
	private readonly text: string;
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _standalone template recording_. **/
	private append_template(node: ts.Node, source_file: ts.SourceFile, comments: CyrillicCommentText[]): void {
		if (!ts.isExpressionStatement(node)) {
			return;
		}
		let expression = node.expression;
		while (ts.isParenthesizedExpression(expression)) {
			expression = expression.expression;
		}
		if (!ts.isTemplateLiteral(expression)) {
			return;
		}
		const start = expression.getStart(source_file);
		comments.push({
			line: source_file.getLineAndCharacterOfPosition(start).line + 1,
			text: this.text.slice(start, expression.getEnd()),
		});
	}

	/** Responsibilities: _standalone Python line recording_. **/
	private append_continuation(
		line: string,
		line_number: number,
		delimiter: string,
		comments: CyrillicCommentText[],
	): string {
		comments.push({ line: line_number, text: line });
		if (line.includes(delimiter)) {
			return "";
		}
		return delimiter;
	}

	/** Responsibilities: _Python string comment openings_. **/
	private append_opening(line: string, line_number: number, comments: CyrillicCommentText[]): string {
		const match = line.match(/^[ \t]*[rRuUbBfFtT]{0,2}("""|''')/u);
		if (match === null) {
			return "";
		}
		comments.push({ line: line_number, text: line });
		const content = line.slice(match[0].length);
		if (content.includes(match[1])) {
			return "";
		}
		return match[1];
	}

	/** Responsibilities: _standalone Python line dispatch_. **/
	private append_line(line: string, line_number: number, delimiter: string, comments: CyrillicCommentText[]): string {
		if (delimiter !== "") {
			return this.append_continuation(line, line_number, delimiter, comments);
		}
		return this.append_opening(line, line_number, comments);
	}

	/** Responsibilities: _standalone string comment initialization_. **/
	public constructor(text: string) {
		this.text = text;
		this.source_file = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	}

	/** Responsibilities: _standalone template collection_. **/
	public typescript_comments(): CyrillicCommentText[] {
		const comments: CyrillicCommentText[] = [];
		const visit = (node: ts.Node): void => {
			this.append_template(node, this.source_file, comments);
			node.forEachChild(visit);
		};
		this.source_file.forEachChild(visit);
		return comments;
	}

	/** Responsibilities: _standalone Python triple-quoted collection_. **/
	public python_comments(): CyrillicCommentText[] {
		const comments: CyrillicCommentText[] = [];
		let delimiter = "";
		for (const [index, line] of this.text.split("\n").entries()) {
			delimiter = this.append_line(line, index + 1, delimiter, comments);
		}
		return comments;
	}
}
