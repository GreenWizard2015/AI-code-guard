# `broad-except`

**Purpose:** Broad catches hide unrelated programming failures.

```py
try:
    run()
except Exception:
    recover()
```

TypeScript catches without a specific error boundary are also reported:

```ts
try {
	run();
} catch {
	recover();
}
```

**Fix:** Catch only the expected exception at the I/O, network, process, or JSON boundary.
