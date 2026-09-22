# `python-test-framework-consistency`

Every Python test file must use `unittest`. Test classes must inherit from exactly one fully qualified `unittest.TestCase`; pytest test functions, pytest fixtures, and pytest base classes are not accepted.

Fixture-only support modules are not classified as test files unless their path matches the project's Python test-file convention.
