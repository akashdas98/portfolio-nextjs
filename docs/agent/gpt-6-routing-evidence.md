# GPT-6 delegation evidence (updated 2026-09-30)

## Current GPT-6.1 Sol evidence

Source: [Introducing GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/).
Active choices are GPT-6.1 Sol and GPT-6 Luna only. GPT-6 Astra and GPT-6 Sol
are disallowed; Astra chart values are reference comparators only. The September 23 matrix contains historical
comparators, never eligible routes.

The table transcribes exact rendered SVG point `aria-label` values inspected
2026-09-30 with Playwright. Use the full labels' precision, not the rounded
coordinate prefixes. Cells are **score / API cost per task**. All six new cost
axes are linear; factual error is lower-is-better, other outcomes higher-is-better.
The new charts have no Luna series and no ultra points. The current spawn
interface permits Sol low through ultra and Luna low through max for this project.

| Evaluation | Effort | GPT-6 Astra | GPT-6.1 Sol |
| --- | --- | --- | --- |
| DeepSWE 1.1 | low | 67.0% / $1.60 | 64.4% / $0.17 |
|  | medium | 72.8% / $3.08 | 73.0% / $0.42 |
|  | high | 73.2% / $3.92 | 75.2% / $0.65 |
|  | xhigh | 74.1% / $4.43 | 71.9% / $0.79 |
|  | max | 73.2% / $7.50 | 71.9% / $1.57 |
| GDP.pdf | low | 30.4% / $1.70 | 27.0% / $0.33 |
|  | medium | 30.4% / $1.72 | 30.0% / $0.34 |
|  | high | 31.0% / $1.79 | 32.0% / $0.35 |
|  | xhigh | 32.2% / $1.91 | 31.8% / $0.37 |
|  | max | 31.0% / $2.08 | 31.0% / $0.42 |
| AutomationBench 1.0.6 | low | 30.3% / $1.08 | 24.7% / $0.16 |
|  | medium | 34.1% / $1.27 | 31.7% / $0.19 |
|  | high | 37.1% / $1.44 | 33.2% / $0.23 |
|  | xhigh | 39.0% / $1.50 | 35.5% / $0.25 |
|  | max | 41.4% / $1.73 | 36.1% / $0.30 |
| OSWorld 2.0 offline | low | 62.2% / $2.72 | 59.0% / $0.42 |
|  | medium | 69.3% / $5.36 | 66.8% / $0.77 |
|  | high | 70.0% / $6.91 | 69.6% / $0.96 |
|  | xhigh | 71.3% / $7.49 | 69.4% / $1.05 |
|  | max | 73.5% / $9.44 | 71.4% / $1.27 |
| Terminal-Bench Science 0.1 | low | 55.4% / $11.41 | 43.7% / $1.79 |
|  | medium | 57.4% / $12.34 | 47.6% / $2.34 |
|  | high | 62.0% / $14.95 | 51.1% / $2.76 |
|  | xhigh | 60.9% / $15.76 | 53.7% / $2.89 |
|  | max | 68.1% / $23.80 | 57.0% / $5.47 |
| Factual error | low | 6.3% / $0.24 | 7.7% / $0.05 |
|  | medium | 4.4% / $0.31 | 6.3% / $0.06 |
|  | high | 3.9% / $0.48 | 4.5% / $0.08 |
|  | xhigh | 4.0% / $0.60 | 4.1% / $0.10 |
|  | max | 3.9% / $0.79 | 4.6% / $0.13 |

## Implications and limits

These are comparisons among task-appropriate candidates, not a difficulty scale.
GPT-6.1 Sol medium now exceeds Astra low in DeepSWE and OSWorld, so the old
recommendation based on GPT-6 Sol medium being weaker is superseded. Astra is
excluded by project policy, regardless of its benchmark score. In science,
Sol max remains below the Astra comparator at high and max; the price advantage
does not eliminate that capability gap. Higher effort is not uniformly better:
Sol high exceeds its xhigh/max DeepSWE points, and its factual-error rate worsens
from xhigh to max. Select reasoning depth from the actual remaining work.

No GPT-6.1 Sol FrontierCode or Agents' Last Exam points are published here.
Do not relabel the old Sol values or infer a Luna crossover from this update.
OSWorld costs for the same Astra scores differ from September 23; use the new
within-chart comparisons without pooling costs. The science Astra max score also
differs from the earlier Astra launch article. These are source-version differences,
not evidence of local speed or cost changes. Research/API harnesses and production
behavior can differ; factuality uses deliberately error-inducing conversations.
Unreported uncertainty prevents treating small score gaps as established superiority.

Standard GPT-6.1 Sol API rates are $2 input, $0.10 cached input and $10 output per
million tokens. Those rates and benchmark task costs do not establish Codex quota
savings, local acceptance, retries or review burden. This repository has no
completed-task comparison measuring those outcomes for the replacement model.

## Historical September 23 baseline (superseded Sol guidance)

The original matrix and interpretation below are retained as dated evidence.
Every Sol value below means GPT-6 Sol, never GPT-6.1 Sol. Its route suggestions
are historical; use the current decision procedure and evidence above. Older
Astra/Luna values can inform workload context only with their original harness
and date, not a synthesized current comparison.

Source: https://openai.com/index/introducing-gpt-6-sol-and-luna/

The figures below are transcribed from the rendered, downloadable SVG charts' point
`aria-label` values, not estimated from pixel positions. Each cell is **score / API
cost per task**. The six chart axes use logarithmic cost and linear outcome scales.
Higher scores are better except factual error, where lower is better. The figures
report low through max; they do not evaluate Codex's `ultra` setting.

| Evaluation | Effort | Astra | Sol | Luna |
| --- | --- | --- | --- | --- |
| AutomationBench 1.0.6 | low | 30.3% / $1.08 | 21.2% / $0.19 | 1.2% / $0.0060 |
| | medium | 34.1% / $1.27 | 26.9% / $0.21 | 9.4% / $0.016 |
| | high | 37.1% / $1.44 | 31.2% / $0.24 | 14.5% / $0.021 |
| | xhigh | 39.0% / $1.50 | 33.2% / $0.27 | 12.6% / $0.025 |
| | max | 41.4% / $1.73 | 32.0% / $0.34 | 20.7% / $0.037 |
| Agents’ Last Exam V1 | low | 53.4% / $3.07 | 48.7% / $0.86 | 36.3% / $0.025 |
| | medium | 57.6% / $4.10 | 53.1% / $1.27 | 46.8% / $0.11 |
| | high | 57.8% / $4.64 | 52.6% / $1.53 | 43.6% / $0.11 |
| | xhigh | 58.3% / $5.40 | 55.4% / $1.67 | 47.9% / $0.11 |
| | max | 59.3% / $6.23 | 56.4% / $2.93 | 50.9% / $0.15 |
| Factual error | low | 6.3% / $0.24 | 11.4% / $0.050 | 27.7% / $0.0024 |
| | medium | 4.4% / $0.31 | 6.9% / $0.069 | 17.5% / $0.0033 |
| | high | 3.9% / $0.48 | 5.1% / $0.099 | 12.5% / $0.0045 |
| | xhigh | 4.0% / $0.60 | 4.5% / $0.13 | 10.2% / $0.0062 |
| | max | 3.9% / $0.79 | 4.6% / $0.18 | 7.6% / $0.012 |
| FrontierCode 1.1 Main | low | 45.3% / $1.70 | 37.3% / $0.45 | 25.7% / $0.021 |
| | medium | 48.8% / $2.43 | 45.9% / $0.80 | 35.5% / $0.053 |
| | high | 50.9% / $3.01 | 47.7% / $1.08 | 37.3% / $0.067 |
| | xhigh | 50.6% / $3.28 | 48.4% / $1.37 | 37.1% / $0.073 |
| | max | 53.3% / $4.59 | 49.3% / $2.14 | 42.4% / $0.11 |
| DeepSWE 1.1 | low | 67.0% / $1.60 | 37.2% / $0.16 | 2.4% / $0.0057 |
| | medium | 72.8% / $3.08 | 56.6% / $0.38 | 44.5% / $0.052 |
| | high | 73.2% / $3.92 | 65.3% / $0.64 | 59.3% / $0.084 |
| | xhigh | 74.1% / $4.43 | 66.6% / $1.00 | 61.3% / $0.11 |
| | max | 73.2% / $7.50 | 68.8% / $2.74 | 66.6% / $0.22 |
| OSWorld 2.0 offline | low | 62.2% / $2.55 | 43.9% / $0.97 | 8.3% / $0.030 |
| | medium | 69.3% / $5.10 | 54.0% / $1.32 | 31.5% / $0.062 |
| | high | 70.0% / $6.60 | 58.3% / $1.64 | 41.4% / $0.12 |
| | xhigh | 71.3% / $7.17 | 60.5% / $2.21 | 46.7% / $0.16 |
| | max | 73.5% / $9.07 | 64.4% / $3.25 | 52.7% / $0.27 |

## Reading the comparisons for delegation

- **Coding:** FrontierCode tests correctness, mergeability, test quality, scope and
  style. Sol medium (45.9%, $0.80) slightly exceeds Astra low (45.3%, $1.70)
  at about 47% of its task cost. Sol high and xhigh improve further while staying
  below Astra low's cost. DeepSWE tests longer engineering work and gives a
  different answer: Astra low (67.0%, $1.60) substantially exceeds Sol medium
  (56.6%, $0.38); Sol xhigh (66.6%, $1.00) nearly matches it, while Luna max
  (66.6%, $0.22) reaches the same score in this evaluation. These results justify
  choosing by task shape and required reliability, not a fixed model ladder.
- **Professional workflows:** AutomationBench tests workflows across 47 tools.
  Sol high exceeds Astra low (31.2% vs 30.3%) at $0.24 vs $1.08. On Agents’
  Last Exam's long-horizon work, Sol medium nearly matches Astra low (53.1%
  vs 53.4%) at $1.27 vs $3.07; Sol xhigh exceeds it (55.4%, $1.67). Astra
  reaches higher absolute scores at higher efforts on both evaluations.
- **Factuality and computer use:** On the error-inducing factuality set, Sol high
  beats Astra low's error rate (5.1% vs 6.3%) at $0.099 vs $0.24. Astra medium
  and above remain more accurate. On OSWorld, Astra low (62.2%, $2.55) exceeds
  Sol xhigh (60.5%, $2.21); Sol max (64.4%, $3.25) exceeds Astra low but costs
  more. Capability-sensitive computer work can therefore warrant Astra initially.
- **Luna and effort:** Luna's low-effort scores are especially weak on some
  long-horizon evaluations; high or max materially changes its performance.
  Effort does not increase scores monotonically in every chart: AutomationBench
  Sol max is below xhigh, for example. Preserve independent effort selection;
  do not assume max is automatically best.

The article reports API prices of $2 input / $10 output per million tokens for
Sol and $0.10 / $0.50 for Luna, each reduced from GPT-5.6 promotional pricing.
It also reports improved prompt caching and 90% discounted cached input reads.
Those token rates are separate from measured cost per benchmark task and from
Codex subscription usage. The article says Astra remains its most capable model,
especially for demanding work, and reports GPT-6 Sol and Luna availability in
Codex. Its coding-deception chart uses only max effort on a deliberately difficult
internal set: Astra 0.5%, Sol 1.3%, Luna 2.8%. This is not a typical-use rate.

The article cautions that its evaluations ran in research/API conditions that may
produce different results in production ChatGPT. The factuality cases were
selected because a prior model had made an error, so they are not typical usage.
Neither cross-benchmark score comparisons nor API-priced task costs measure this
repository's accepted-outcome rate, review time, retries, latency or total Codex
usage. Use these charts as routing evidence, then verify actual work at its own
acceptance boundary. The existing Codex effort options remain low through ultra
for Astra/Sol and low through max for Luna; the article plots only low through max.
