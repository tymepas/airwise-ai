# Retrieval evaluation

`retrieval-cases.json` contains 30 natural-language regression cases. A case
passes when at least one expected guidance document appears in the top four
retrieved documents (recall@4).

Run the application, then execute:

```powershell
$env:AIRWISE_BASE_URL = "http://localhost:3000"
npm run evaluate:retrieval
```

For an Elasticsearch-only regression run that does not consume Gemini quota,
start the app with `AIRWISE_QUERY_PLANNER=deterministic`. Production defaults
to Gemini query planning and automatically falls back to this deterministic
expansion if the planner is unavailable.

## Latest verified result

| Metric | Result |
| --- | --- |
| Cases | 30 |
| Retrieval recall@4 | 100% (30/30) |
| Median retrieval latency | 381 ms |
| Evidence readiness | 100% of passing cases returned ranked, source-backed evidence |

This suite deliberately measures retrieval and evidence readiness, not the
clinical quality of Gemini's final language. End-to-end answer evaluation
requires versioned, clinician-reviewed expected answers and should be added
before making clinical-quality claims.
