# `python-test-assertion-alias`

**Purpose:** Keep Python unittest assertions explicit at the test call site.

```py
checks = (self.assertTrue, self.assertEqual)
checks[0](actual)
```

**Fix:** Call `self.assert*` directly in the test method. Do not store assertion
methods in variables, tuples, lists, or mappings before calling them.
