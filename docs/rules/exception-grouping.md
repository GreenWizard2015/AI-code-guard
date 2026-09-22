# `exception-grouping`

**Purpose:** A one-use exception should stay close to the caller that handles it.

```py
# scattered across unrelated files
class NetworkError(Exception): ...
```

**Fix:** Move the `Error` class into its caller module, or group related exceptions in one
focused module. Do not keep a one-use exception isolated in its own file.
