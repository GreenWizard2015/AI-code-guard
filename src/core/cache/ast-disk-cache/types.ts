import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { AstCacheRecord } from "src/model_types";

export type AstCacheSourceIdentity = {
	readonly source_file: string;
	readonly source_hash: string;
};

export type AstCacheWriteRequest = {
	readonly source_file: string;
	readonly source_text: string;
	readonly ast: NormalizedAstFile;
};

export type AstCachePublication = {
	readonly path: string;
	readonly record: AstCacheRecord;
};
