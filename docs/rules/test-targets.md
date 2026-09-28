# `test-targets`

Test targets are collected from the test file's imports. A test must import at
least one production module outside `tests` or `__tests__`:

```ts
import 'src/payments/reader';
import 'src/payments/writer';
```

The common source root of the production imports must match the module path
represented by the test file. Imports from `tests` or `__tests__` do not count,
and external or standard-library imports do not identify a source root. The
rule intentionally does not check whether an imported target file exists.

Python tests use ordinary imports in the same way:

```python
from payments.reader import Reader
from payments.writer import Writer
```
