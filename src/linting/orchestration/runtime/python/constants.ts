export const PYTHON_COLLECTIONS_ABC_MODULE = "collections.abc";
export const PYTHON_TYPING_MODULE_NAME = "typing";
export const PYTHON_BUILTINS_MODULE_NAME = "builtins";
export const PYTHON_ARRAY_MODULE_NAME = "array";

export const PYTHON_COLLECTIONS_MUTABLE_TYPES = [
	"ChainMap",
	"Counter",
	"defaultdict",
	"deque",
	"OrderedDict",
	"UserDict",
	"UserList",
	"UserString",
];
export const PYTHON_ABSTRACT_MUTABLE_TYPES = ["MutableMapping", "MutableSequence", "MutableSet"];
export const PYTHON_TYPING_MUTABLE_TYPES = ["DefaultDict", "Deque", "Dict", "List", "Set"];
export const PYTHON_BUILTIN_MUTABLE_TYPES = ["bytearray", "dict", "list", "set"];
export const PYTHON_MUTABLE_COLLECTION_NAME_GROUPS = [
	PYTHON_COLLECTIONS_MUTABLE_TYPES,
	PYTHON_ABSTRACT_MUTABLE_TYPES,
	PYTHON_TYPING_MUTABLE_TYPES,
	PYTHON_BUILTIN_MUTABLE_TYPES,
	[PYTHON_ARRAY_MODULE_NAME],
];
