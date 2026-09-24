# GPT-6 delegation evidence (2026-09-23)

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
