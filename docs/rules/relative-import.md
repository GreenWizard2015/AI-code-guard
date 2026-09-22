# `relative-import`

**Purpose:** Keep project dependencies rooted in one explicit import base so moving a file does
not silently change how its dependencies are resolved.

```ts
import { User } from "../domain/user";
```

```py
from .domain.user import User
user = User()
```

**Fix:** Configure the project to resolve imports from either `{project root}` or
`{project root}/src`, then use an absolute package/module name. Keep the same base in the compiler,
runtime, test runner, bundler, and Python packaging configuration.

For a repository-root layout, TypeScript can use `"baseUrl": "."` and Python can use
`PYTHONPATH=.` (or an installed package). For a `src` layout, use `"baseUrl": "./src"` and
`PYTHONPATH=src` (or an editable package installation). Keep this setting identical in every
runtime and test command.

Do not silence this rule with aliases that still contain `./` or `../`, `sys.path` mutations, or
per-file exceptions. The rule reports every TypeScript module specifier beginning with `./` or
`../` (including `import = require(...)`) and every Python `from` import with one or more leading
relative-import dots.
