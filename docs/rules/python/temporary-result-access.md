# `temporary-result-access`

Description: Assign copied lists and dictionaries created with unpacking before
accessing their members. Named field and method access on ordinary function
results is allowed.

## Bad


```python
return Reader().read()
return Reader().payload
return resolve(input)[key]
[*rule_ids].sort()
{**rule_options}["mode"]
```

**Fix:** Assign constructed objects, indexed call results, and unpacked copies
to named variables before using them. Ordinary list and dictionary literals are
permitted.

## Good


```python
# File: cli.py
if __name__ == "__main__":
    response = resolve(input_value)
    payload = response.payload
    rendered = resolve(input_value).render()
    copied_rule_ids = [*rule_ids]
    copied_rule_ids.sort()
    option_snapshot = {**rule_options}
    print(payload, rendered, copied_rule_ids, option_snapshot["mode"])
```
