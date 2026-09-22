# `test-assertion-grouping`

**Purpose:** Keep one result shape in one object comparison instead of three or more separate assertions.

```py
self.assertEqual(
    {
        "name": class_node["name"],
        "baseClassNames": class_node["baseClassNames"],
        "visibility": class_node["methods"][0]["visibility"],
    },
    {
        "name": "Service",
        "baseClassNames": ["Record"],
        "visibility": "private",
    },
)
```

The same rule applies to Jest `expect` calls. It reports tests with three or more direct assertion statements.

Tests with more than five direct assertions also receive a complexity warning. Split them into smaller atomic tests.
