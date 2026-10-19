# `cyrillic-comment`

Description: Comments and supported text files must use English. Cyrillic remains allowed
inside a source string assigned to a value or returned from a callable.

## Bad


```python
# File: cli.py
if __name__ == "__main__":
    # Состояние приложения готово.
    message = "Ready"
    print(message)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    # User-facing localized text stays in data.
    message = "Готово"
    print(message)
```
