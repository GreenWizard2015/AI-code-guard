# `reexports`

Description: Re-exporting imported symbols obscures the defining module.

Before:



After:


Fix: Import `Client` from its defining module at the use site. Update all callers before removing a facade, and keep an entry-point export only when it is part of the intentional external API.

Registry example:



Do not preserve an internal compatibility alias just to avoid updating callers.
The rule also rejects type-only re-exports; import the type from its defining module instead.

```python
# feature.py
from .client import Client

__all__ = ['Client']
```

## Bad


```python
from .client import Client  # <- error
__all__ = ["Client"]
```

## Good


```python
from package.client import Client
Client.connect()
```
