# import-fan-out

Description: Problem: module imports too many distinct modules.

Hint: Split the module by cohesive responsibility or move composition wiring to
a focused assembly module. Do not: bypass the limit by importing individual
objects through aliases.

The rule counts unique module specifiers, not imported names. For example,
`import { A, B } from "./module"` counts as one module.

## Bad

```ts
// File: cli.ts
import 'domain/module_01'; // <- error
import 'domain/module_02'; // <- error
import 'domain/module_03'; // <- error
import 'domain/module_04'; // <- error
import 'domain/module_05'; // <- error
import 'domain/module_06'; // <- error
import 'domain/module_07'; // <- error
import 'domain/module_08'; // <- error
import 'domain/module_09'; // <- error
import 'domain/module_10'; // <- error
import 'domain/module_11'; // <- error
import 'domain/module_12'; // <- error
import 'domain/module_13'; // <- error
import 'domain/module_14'; // <- error
import 'domain/module_15'; // <- error
import 'domain/module_16'; // <- error
import 'domain/module_17'; // <- error
import 'domain/module_18'; // <- error
import 'domain/module_19'; // <- error
import 'domain/module_20'; // <- error
import 'domain/module_21'; // <- error
```


## Good

```ts
// File: cli.ts
import 'application/account-workflow';
```

