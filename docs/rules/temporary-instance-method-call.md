# `temporary-instance-method-call`

**Purpose:** `new T().method()` hides lifecycle and repeated allocation.

```ts
return new Resolver().resolve(input);
```

**Fix:** Create the dependency at the composition root or in the constructor and reuse it.

For filename classification, pass one immutable wrapper through the collector boundary instead of
creating it inside each predicate:

```ts
const FILE_PATH = new LintFileName(file);
append_mix_violations(violations, ast, FILE_PATH);
```

The collector uses `file_name.is_test_py()` and `file_name.value`; it does not receive the same
filename as both a string and a wrapper.
