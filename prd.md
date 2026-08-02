# Product Requirements Document

# Project Name

Context

---

# Vision

Context helps users understand information on X before believing or sharing it.

Instead of asking AI to answer questions from memory, Context retrieves evidence from the web and explains it.

The goal is to reduce misinformation by making context available with one click.

---

# MVP Scope

Supported Platform

- X (Twitter)

Supported Features

- Know the Context
- Analyze Claim

Out of Scope

- Instagram
- YouTube
- Reddit
- Timeline generation
- Bias analysis
- Author history
- Community notes
- Browser-wide support

---

# User Problem

Users encounter posts that

- lack context
- contain misinformation
- reference events they don't understand

Finding context currently requires

- opening multiple tabs
- searching manually
- reading several articles

The process is slow.

---

# Solution

Right-click selected text.

Choose

Know the Context

or

Analyze Claim

Receive

- summary
- evidence
- sources

without leaving X.

---

# Functional Requirements

## Know the Context

Input

Selected tweet text.

Output

- Summary
- Background
- Related information
- Sources

---

## Analyze Claim

Input

Selected tweet text.

Output

- Claim classification
- Verdict (if factual)
- Reasoning
- Evidence
- Sources

---

# Claim Types

Fact

Opinion

Prediction

Question

Mixed

Only factual claims receive verdicts.

---

# Search Pipeline

Classifier

↓

Search

↓

Evidence

↓

Summarize

↓

Response

---

# Performance Goals

Initial response

<2 seconds

Complete response

<8 seconds

Maximum search rounds

3

---

# Non Functional Requirements

Reliability

Search grounded.

Accuracy

Evidence first.

Scalability

Search provider abstraction.

Security

Prompt injection resistant.

Privacy

Only selected tweet context is sent.

---

# Caching

Cache by

platform

tweet URL

normalized selection

action

TTL

6–24 hours

---

# Rate Limits

Anonymous

30 requests/hour

Authenticated

Higher limits

Maximum selection

2000 characters

---

# Success Metrics

Median response time

<5 seconds

Search success rate

>95%

User satisfaction

Positive qualitative feedback

Reduction in repeated searches

High cache hit rate
