# import-fan-out

Description: Problem: module imports too many distinct modules.

Hint: Split the module by cohesive responsibility or move composition wiring to
a focused assembly module. Do not: bypass the limit by importing individual
objects through aliases.

The rule counts unique module specifiers, not imported names. For example,
`import { A, B } from "./module"` counts as one module.

## Bad


```python
# File: cli.py
if __name__ == '__main__':
    import account  # <- error
    import billing  # <- error
    import cache  # <- error
    import database  # <- error
    import email_service  # <- error
    import metrics  # <- error
    import queue_service  # <- error
    import search  # <- error
    import transport  # <- error
    import module_10  # <- error
    import module_11  # <- error
    import module_12  # <- error
    import module_13  # <- error
    import module_14  # <- error
    import module_15  # <- error
    import module_16  # <- error
    import module_17  # <- error
    import module_18  # <- error
    import module_19  # <- error
    import module_20  # <- error
    import module_21  # <- error
    account.start()
    billing.start()
    cache.start()
    database.start()
    email_service.start()
    metrics.start()
    queue_service.start()
    search.start()
    transport.start()
```

## Good


```python
import account_workflow
account_workflow.start()
```
