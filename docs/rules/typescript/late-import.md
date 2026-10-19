# `late-import`

Description: Keep static imports at the beginning of the file after the module docstring and future imports.

## Bad

```ts
if (is_ready()) {}
import { Item } from "domain/item"; // <- error
```


## Good

```ts
import { Item } from "domain/item";
```

