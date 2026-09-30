# `numeric-name`

Names of project-owned symbols must not contain numbers. This applies to
classes, types, fields, methods, functions, parameters, and local variables in
both TypeScript and Python.

```ts
const item1 = load_item();
class Version2 {}
```

Use a descriptive word instead:

```ts
const first_item = load_item();
class SecondVersion {}
```

The rule does not inspect test files, consistent with the project policy that
test names and test-local naming are outside naming checks. External runtime
names are not declarations owned by the project and are not renamed by this
rule.
