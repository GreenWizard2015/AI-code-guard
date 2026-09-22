# `complex-default-parameter`

**Purpose:** Parameter defaults must not allocate dependencies or mutable state before the
caller's lifecycle is explicit.

```ts
function create(record_reader: RelaySourceReaderPort = new RelaySourceReader()) {}
```

```py
def create(record_reader: RelaySourceReaderPort = RelaySourceReader()):
    pass
```

**Fix:** Use `null` or `None`, then create or validate the value explicitly in the constructor or
caller. Primitive literals remain valid defaults.

```ts
class RecordLoader {
  private readonly record_reader: RelaySourceReaderPort;

  public constructor(record_reader: RelaySourceReaderPort) {
    this.record_reader = record_reader;
  }
}
```

```py
def __init__(self, record_reader: RelaySourceReaderPort):
    self.record_reader = record_reader
```

Do not hide object creation, factory calls, lambdas, arrays, dictionaries, or other mutable values
in a parameter default.
