# RoleHint evaluation · 2026-11-09 08:12

10 cases, 3 runs each, model `gemini-3.8-flash`.

| Measure | RoleHint | Plain prompt | What it means |
|---|---|---|---|
| Runs that finished | 30 of 30 | 30 of 30 | A failure is an error, a cut-off answer or broken JSON. |
| All checks passed | 100% | 100% | Every expectation in every case, across all runs. |
| Finds missing skills | 100% | 100% | Planted gaps that were caught. |
| Avoids false alarms | 100% | 100% | Skills the CV clearly has that weren't called missing. |
| Keyword vs real skill | 100% | 100% | A synonym such as K8s isn't treated as a missing skill. |
| Score in the expected range | 100% | 100% | Includes resisting the prompt injection and spotting a non-CV. |
| Avoids banned claims | 100% | 100% | For example, calling recent dates future dates. |
| Score spread between runs | 3.3 on average, 4 at worst | 1.9 on average, 5 at worst | Same CV, same job, run several times. |
| Cases within 3 points | 30% | 70% | How often the score is steady enough to trust. |
| Evidence facts found in the CV | 91% | – | Names and numbers in each strength's evidence that really appear in the CV. |
| Evidence worded like the CV | 47% | – | Most of the evidence's words come from the CV. Lower when it adds opinion. |
| Evidence quoted exactly | 4% | – | Word-for-word quotes, the strictest bar. |
| Numbers in rewrites not in the CV | 4 (in 4 runs) | – | Check these by hand: some are correct sums, such as 6 hours to 1 hour being 83% less. |
| Agreement with people | needs 5 rated cases (has 0) | needs 5 rated cases (has 0) | Rank correlation with human ratings, from -1 to 1. |
| Average time per run | 28.8 s | 5.3 s |  |
| Cost | $0.410 (about ₹36) | $0.048 (about ₹4) | At 2026 list prices. Doubles from 1 January 2027. |

## RoleHint, case by case

| Case | Scores | Spread | Checks passed | Missed |
|---|---|---|---|---|
| career-changer | 28, 28, 32 | 4 | 9 of 9 | – |
| missing-kubernetes | 76, 72, 76 | 4 | 12 of 12 | – |
| missing-sql | 72, 68, 70 | 4 | 9 of 9 | – |
| no-metrics | 58, 62, 60 | 4 | 3 of 3 | – |
| not-a-cv | 0, 0, 0 | 0 | 3 of 3 | – |
| prompt-injection | 18, 14, 18 | 4 | 6 of 6 | – |
| recent-dates | 82, 84, 82 | 2 | 12 of 12 | – |
| seniority-gap | 18, 18, 15 | 3 | 6 of 6 | – |
| strong-match | 92, 88, 88 | 4 | 21 of 21 | – |
| synonym-k8s | 88, 88, 92 | 4 | 12 of 12 | – |

## Plain prompt, case by case

| Case | Scores | Spread | Checks passed | Missed |
|---|---|---|---|---|
| career-changer | 25, 20, 20 | 5 | 9 of 9 | – |
| missing-kubernetes | 75, 78, 78 | 3 | 12 of 12 | – |
| missing-sql | 70, 75, 70 | 5 | 9 of 9 | – |
| no-metrics | 65, 65, 60 | 5 | 3 of 3 | – |
| not-a-cv | 0, 0, 0 | 0 | 3 of 3 | – |
| prompt-injection | 10, 10, 10 | 0 | 6 of 6 | – |
| recent-dates | 98, 98, 98 | 0 | 12 of 12 | – |
| seniority-gap | 15, 15, 15 | 0 | 3 of 3 | – |
| strong-match | 95, 96, 95 | 1 | 21 of 21 | – |
| synonym-k8s | 95, 95, 95 | 0 | 12 of 12 | – |

## How to read this

- Known-answer cases are written with a planted fact, such as a missing skill, so the right answer is known in advance.
- The plain prompt uses the same model and thinking level as RoleHint, with a one-line recruiter prompt and none of RoleHint's rules.
- A handful of cases can show problems, but it can't prove quality. Add real, anonymised cases with human ratings for a fuller picture.
