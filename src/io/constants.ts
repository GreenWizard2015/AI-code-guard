// Filesystem and process errors treated as expected boundary failures.
export const SYSTEM_PERMISSION_DENIED_CODE = "EPERM";
export const SYSTEM_MISSING_PROCESS_CODE = "ESRCH";
export const SYSTEM_FAILURE_CODES: readonly string[] = [
	"EACCES",
	"EBUSY",
	"EEXIST",
	"EISDIR",
	"EINVAL",
	"EIO",
	"ENOENT",
	"ENOTDIR",
	"ENOTEMPTY",
	SYSTEM_PERMISSION_DENIED_CODE,
	SYSTEM_MISSING_PROCESS_CODE,
	"EXDEV",
];
