# User Flow

# Flow 1 — Know the Context

```
User selects tweet text
        │
        ▼
Right Click
        │
        ▼
Know the Context
        │
        ▼
Context menu event
        │
        ▼
Open Side Panel
        │
        ▼
Extract

- Selection
- Tweet
- URL
- Author
        │
        ▼
Backend Request
        │
        ▼
Classifier
        │
        ▼
Search
        │
        ▼
Evidence
        │
        ▼
Summary
        │
        ▼
Render Response
```

---

Response

```
Summary

Background

Sources

Related Reading
```

---

# Flow 2 — Analyze Claim

```
User selects text
        │
        ▼
Analyze Claim
        │
        ▼
Extract Context
        │
        ▼
Classifier
        │
        ▼
Extract Claims
        │
        ▼
Search
        │
        ▼
Evidence
        │
        ▼
Verdict
        │
        ▼
Render
```

---

Response

```
Claim

Type

Fact

Opinion

Prediction

Question

↓

If Fact

Verdict

Reasoning

Evidence Strength

Sources

↓

If Opinion

Explain why it cannot be verified.

Provide supporting context.

↓

If Mixed

Split into multiple claims.

Analyze each independently.
```

---

# Extension Flow

```
Content Script

↓

Context Menu

↓

Background Worker

↓

Side Panel

↓

Express Backend

↓

Search Service

↓

LLM

↓

Response
```

---

# Streaming Flow

```
User clicks

↓

Opening panel...

↓

Searching...

↓

Found 5 sources...

↓

Analyzing...

↓

Done
```

---

# Failure States

No search results

↓

Tell user no reliable evidence was found.

---

Search timeout

↓

Return partial results.

---

Opinion selected

↓

Return context instead of factual verdict.

---

Mixed claim

↓

Split and analyze individually.

---

# Future Flows

- Instagram support
- YouTube support
- Reddit support
- Timeline generation
- Contradiction detection
- Cross-platform context
