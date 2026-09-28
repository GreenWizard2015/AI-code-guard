# `typescript-namespace-file`

A TypeScript file containing a namespace must contain exactly one namespace declaration. Outside that namespace, only static imports are allowed.

Keep classes, functions, values, and nested ownership inside the namespace so the file has one explicit boundary. The normal TypeScript rules still traverse and validate every declaration inside the namespace.
