# functions-file-type-declaration

Root `functions.ts` and `functions.py` files contain cohesive callable implementations only. They must not declare types: TypeScript classes, interfaces, type aliases, or enums, nor Python classes, type aliases, or structural type values.

Move each type description to its owning type module or class. Keep the functions file focused on the small callable boundary; do not hide a type declaration in a namespace, nested scope, alias, or wrapper.
