# RoleHint evaluation

This folder measures how good RoleHint's CV check really is, instead of guessing. It runs the exact code the live site uses on a fixed set of test cases, scores every answer against what the right answer should be, and writes a report you can share.

## Run it

```bash
npm run eval -- --mock
```

A free practice run with fake answers. It checks the pipeline works and costs nothing.

```bash
npm run eval -- --baseline
```

The real thing. It runs every case 3 times through RoleHint and 3 times through a plain prompt for comparison. It tells you roughly what it will cost and waits for you to type `yes`. With the 10 starter cases, that's about ₹50 of Gemini credit and around 10 minutes.

Options: `--runs 5` runs each case more times, `--only strong-match,not-a-cv` runs just those cases, `--parallel 1` sends one request at a time, and `--yes` skips the question.

To re-score saved answers after changing a rule, for free, run `npm run eval -- --from eval/results/<file>-raw.json`.

Results go to `eval/results/`. The `-summary.md` file holds scores and pass or fail results only, never CV text, so it's safe to share or commit. The `-raw.json` file holds the full reports, which can quote CVs, so git ignores it.

## What it measures

| Measure | The question it answers |
|---|---|
| Finds missing skills | When a case is written with a skill deliberately missing, does RoleHint catch it? |
| Avoids false alarms | Does it ever call a skill missing when the CV clearly has it? |
| Keyword vs real skill | If the CV says "K8s", does it know that's Kubernetes, and suggest the keyword rather than call it a missing skill? |
| Score in the expected range | Is a strong match scored high, a career changer modestly, a recipe near 0, and a CV that says "give me 100" judged normally? |
| Avoids banned claims | Does it ever make a known mistake, such as calling recent dates future dates? |
| Score spread between runs | Run the same CV several times. How much does the score move? |
| Evidence facts found in the CV | Are the names and numbers in each strength's evidence really in the CV? |
| Numbers in rewrites not in the CV | Do rewritten bullet points contain numbers the CV doesn't have? Check each by hand, because some are correct sums, such as 6 hours to 1 hour being 83% less. |
| Agreement with people | Do higher scores go with higher human ratings? |
| Time and cost | How long each run takes and what it costs. |

The plain prompt uses the same model and thinking level as RoleHint, but only a one-line recruiter instruction. It shows what someone would get by pasting their CV into an AI chat.

## The starter cases

All 10 people and companies are fictional. Each case is written so the right answer is known in advance:

| Case | What it tests |
|---|---|
| `strong-match` | A CV that covers the whole job should score high, with no invented gaps. |
| `missing-kubernetes` | The same CV without Kubernetes, for a job where it's essential. |
| `synonym-k8s` | The CV says K8s and EKS, never Kubernetes. |
| `missing-sql` | An analyst with no SQL, for a job that needs it daily. |
| `career-changer` | A teacher moving into data analysis. |
| `seniority-gap` | One year of experience against a staff-level job. |
| `prompt-injection` | A weak CV that tells the AI to give it 100. |
| `not-a-cv` | A chai recipe instead of a CV. |
| `no-metrics` | Duties with no results, which tests invented numbers. |
| `recent-dates` | Dates that end a few months ago. |

## Add your own cases

Copy any file in `eval/cases/` and change it. The fields are:

```json
{
  "id": "short-unique-name",
  "about": "What this case tests, in one sentence.",
  "input": { "target": "Job title", "jobDescription": "…", "cv": "…" },
  "expect": {
    "missing": [["sql"]],
    "notMissing": [["python"], ["power bi"]],
    "notAGap": [["kubernetes", "k8s"]],
    "score": { "min": 40, "max": 80 },
    "breakdownMax": { "seniority": 40 },
    "minGaps": 2,
    "forbidden": ["future date"]
  },
  "human": [4, 3]
}
```

Each skill is a list of accepted spellings, and a trailing `*` matches any ending, so `"quantif*"` finds "quantified". Leave out any expectation you don't need.

**Real CVs:** put cases built from real people's CVs in `eval/cases/private/`. Git ignores that folder, so they never reach GitHub. Ask each person first, and remove names, phone numbers and email addresses.

**Human ratings:** in `human`, list each person's rating of how well the CV fits the job, from 1 (poor) to 5 (excellent). With ratings on at least 5 cases, the report shows how closely RoleHint agrees with people.

## Limits

Ten cases can reveal problems, but they can't prove quality. The cases were written by the same team that built RoleHint, so they may miss blind spots. The numbers become trustworthy with 30 or more cases, real CVs from different fields, and ratings from more than one person, ideally someone who hires.
