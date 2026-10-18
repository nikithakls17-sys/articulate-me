# Evaluation samples

20 hand-written learner transcripts for Days 1-3, used to measure how well the feedback engine grades
technique use. No model has seen or graded these yet.

| Day | Technique | good | partial | bad | tricky |
|---|---|---|---|---|---|
| 1 | PREP | 2 | 2 | 2 | 1 |
| 2 | Rule of three | 2 | 2 | 1 | 2 |
| 3 | Open strong | 2 | 2 | 1 | 1 |

- **good**: clearly uses the technique. **partial**: some rubric items missing (e.g. only two reasons, hook comes
  second). **bad**: doesn't use it. **tricky**: built to catch a grader that pattern-matches signal words:
  "because… for example…" with a circular reason and an empty example (d1-07), three "reasons" that are the
  same reason (d2-06), a third reason that's off-topic (d2-07), a rambling story hook that never connects (d3-06).
- Each sample answers the real opening line from that day's conversation scenario for its world, and is
  written like speech (fillers, restarts). d1-02 and d2-01 are two-turn conversations with a partner follow-up.

## File format (`d1-01.json` …)

`turns` (partner + learner), `transcript` (learner lines only: what evidence quotes are checked against),
`rubric` (the day's hand-written rubric), `draft_labels` (Claude's labels written while authoring the sample),
`niki_labels` (empty: the reference labels), `why` (what the sample tests).

## Labelling (Niki, ~15 min)

Open `eval/labels.csv`, read each sample's transcript, and fill `niki_label` with `used`, `partly` or `missing`
for every row (67 rows). Disagree with the draft freely: your labels are the reference. The eval run will
report the grader's agreement with your labels per prompt version (v1 vs v2), per category, plus validator
failure rate, latency, tokens and cost.
