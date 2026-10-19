# `file-max-size`

Description: Detect source files that exceed 500 raw source lines, including comments, blank lines,
docstrings, and test files.


Fix: Split the file by ownership into focused modules. Do not hide file size behind wrappers or
generated-looking padding.

## Bad

```ts
function read_value(): string {
  const first = get_first();
  const second = get_second();
  return first + second;
}
```


## Good

```ts
// File: cli.ts
#!/usr/bin/env node
console.log("ready");
```

