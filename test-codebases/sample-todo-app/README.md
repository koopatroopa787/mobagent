# sample-todo-app

Minimal Flask todo API used as the Phase 1 end-to-end test target for
FieldFix. Small enough that a single-file fix is always realistic.

## Setup

```
pip install -r requirements.txt
flask run        # dev server at http://localhost:5000
pytest -v        # test suite
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /items | list all items |
| POST | /items | add item (`{"text": "..."}`) |
| GET | /items/:id | get one item |
| PATCH | /items/:id | update text and/or done flag |
| DELETE | /items/:id | remove item |

## Using this as a FieldFix test target

This directory is a template. For Phase 1 webhook testing, deploy it
as its own GitHub repo so GitHub Actions can fire `workflow_run` events
at the daemon. The workflow at `.github/workflows/test.yml` runs
`pytest` on every push.

**Suggested break for testing the agent loop:**

In `app.py`, change:

```python
item["done"] = data["done"]
```

to:

```python
item["done"] = False   # bug: ignores the requested value
```

This breaks `test_mark_done` with a clean assertion error on a single
line, which the agent should propose reverting.

## Notes

- State is in-memory only — resets on restart, intentionally.
- Item IDs are 1-indexed append-only counters. Gaps form after deletes;
  the agent's single-file scope means ID reassignment is out of scope.
