# Sample Test Codebase

Phase 1 testing target. Use a small, real todo-app repo here (clone
one, or scaffold a minimal FastAPI/Flask todo API with a small pytest
suite) so there is something to break, get a webhook from, and fix.

Requirements for this sample app:

- Small enough that a single-file fix is realistic
- Has a pytest suite with at least one easily-breakable test (for
  example, an off-by-one or a wrong comparison operator)
- Has a GitHub Actions workflow that runs pytest on push

Do not use a real project for early testing. The daemon will be
applying AI-generated diffs and pushing branches.
