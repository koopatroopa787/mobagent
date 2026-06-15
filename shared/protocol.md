# Phone <-> Daemon Sync Protocol

All messages are JSON over a local HTTP/WebSocket connection
established after QR pairing. The daemon acts as the server; the phone
is the client.

## Pairing

### PAIR_REQUEST (phone -> daemon)
```json
{
  "type": "PAIR_REQUEST",
  "token": "one-time-token-from-qr-code",
  "device_name": "Kanishk's Phone"
}
```

### PAIR_CONFIRM (daemon -> phone)
```json
{
  "type": "PAIR_CONFIRM",
  "session_id": "uuid",
  "repo_name": "sample-todo-app"
}
```

## Alerts

### ALERT_NOTIFY (daemon -> phone)
```json
{
  "type": "ALERT_NOTIFY",
  "alert_id": "uuid",
  "source": "github_actions",
  "summary": "Test 'test_add_item' failed in test_todo.py",
  "raw_log_excerpt": "...",
  "candidate_files": ["src/todo.py"]
}
```

## Triage (on-device, Phase 2)

### TRIAGE_RESULT (phone, internal - informs next step)
```json
{
  "type": "TRIAGE_RESULT",
  "alert_id": "uuid",
  "classification": "simple",
  "confidence": 0.0
}
```
classification is "simple" or "complex". If "complex", the phone sends
the ALERT_NOTIFY payload onward to the daemon for the full agent loop.
If "simple", the phone proceeds to generate FIX_PROPOSAL on-device.

## Fixes

### FIX_PROPOSAL (daemon or phone -> phone for display)
```json
{
  "type": "FIX_PROPOSAL",
  "alert_id": "uuid",
  "file": "src/todo.py",
  "diff": "unified diff text",
  "explanation": "one or two sentence rationale",
  "generated_by": "on_device"
}
```
generated_by is "on_device" or "daemon".

### FIX_APPROVAL (phone -> daemon)
```json
{
  "type": "FIX_APPROVAL",
  "alert_id": "uuid",
  "diff": "unified diff text"
}
```

### FIX_REJECTION (phone -> daemon)
```json
{
  "type": "FIX_REJECTION",
  "alert_id": "uuid",
  "reason": "optional free text"
}
```

## Results

### TEST_RESULT (daemon -> phone)
```json
{
  "type": "TEST_RESULT",
  "alert_id": "uuid",
  "passed": true,
  "output": "..."
}
```

### PUSH_CONFIRM (daemon -> phone)
```json
{
  "type": "PUSH_CONFIRM",
  "alert_id": "uuid",
  "branch": "fieldfix/fix-test-add-item",
  "commit_sha": "abc123"
}
```

## Notes for Implementation

- Every message includes alert_id so the phone and daemon can
  correlate state across the async flow
- diff is always a unified diff string (git diff format), so the
  daemon can apply it with git apply directly
- generated_by on FIX_PROPOSAL lets the daemon distinguish on-device
  fixes (Phase 2) from daemon-generated ones (Phase 1) for logging and
  confidence calibration (see docs/CHALLENGES.md)
