import type ts from "typescript";
import type { TypeScriptModuleCache } from "src/module-resolution/types";

export const MODULE_CACHE_KEY_SEPARATOR = "\u0000";
export const MODULE_CACHE_DISK_SCOPE = "disk";
export const MODULE_CACHE_SNAPSHOT_SCOPE = "snapshot";
export const SHARED_MODULE_CACHES = new WeakMap<ReadonlyMap<string, ts.SourceFile>, TypeScriptModuleCache>();
