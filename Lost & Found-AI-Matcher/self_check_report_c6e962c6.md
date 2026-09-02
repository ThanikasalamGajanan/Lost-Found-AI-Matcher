# Seed corpus self-check

**Scores here come from a crude offline heuristic bundled with the generator, not from the product's matching engine.** Its only purpose is to prove the corpus is separable: if true pairs did not outscore negatives even under a naive scorer, the data would be broken. Real numbers must come from `GET /api/matches` after seeding.

## Corpus shape

- Pairs: **90** (180 reports)
- True pairs: **63 (70.0%)**
- Negatives: **27** (12 hard same-category, 15 unrelated)
- Primary language: 102 English / 78 Tamil
- Owner rule: lost and found pools are disjoint; no pair shares an owner

## Reference score distribution

| group | n | min | p25 | median | p75 | max |
|---|---|---|---|---|---|---|
| true pairs | 63 | 79.0 | 87.6 | 91.6 | 95.8 | 100.0 |
| hard negatives | 12 | 42.7 | 43.5 | 44.8 | 46.8 | 67.9 |
| easy negatives | 15 | 0.0 | 1.5 | 2.7 | 22.1 | 38.7 |
| all negatives | 27 | 0.0 | 2.4 | 31.0 | 44.6 | 67.9 |
| cross non-partner | 5607 | 0.0 | 0.7 | 1.6 | 17.1 | 91.5 |

- Median separation (true - negative): **60.6 points**
- Partner ranked #1 for its lost item: **100.0%**
- Partner ranked top-3: **100.0%**

## Near-miss techniques used

- Location granularity drift (library / library entrance / reading room), plus ~20% of true pairs drifted to an adjacent location
- Time drift: 15-45 min for a third of pairs, hours for most, next-day for a few
- Synonym swap on the head noun (bag / backpack / laptop bag)
- Colour hedging (black / dark-coloured) on ~45% of true pairs
- Finder uncertainty: brand dropped to 'unbranded' ~25% of the time; contents unknown ~35% of found reports (bag not opened)
- Cross-language pairs (~42%): Tamil lost report vs English found report and vice versa
