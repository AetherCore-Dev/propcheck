# Ship Confidence: How Many Tests Do You Actually Need?

> Draft outline for the TS-4 authority article. Target platforms: Hacker News, Dev.to, Medium.

---

## Hook

Every developer has shipped code while thinking "I hope this doesn't break." Unit tests pass. Coverage is 100%. Yet production bugs still happen. Why?

Because **coverage measures which lines you executed, not which behaviors you verified.**

This article introduces a framework for measuring *test confidence* — not just coverage — and maps it to real industry standards from aviation, automotive, and medical device software.

---

## Part 1: The Coverage Lie

### Coverage ≠ Correctness

```typescript
function applyDiscount(price: number, discount: number): number {
  return price * (1 - discount / 100);
}

// Test: 100% line coverage, 100% branch coverage
test("10% off $100", () => expect(applyDiscount(100, 10)).toBe(90));
```

This test covers every line and branch. Coverage report says 100%. But what about `applyDiscount(49.99, 150)`? A 150% discount produces a **negative price**. The function has no guard, and no test catches it.

### What Coverage Actually Measures

| Metric | What it checks | What it misses |
|--------|---------------|----------------|
| Line coverage | "Was this line executed?" | Edge cases, boundary conditions |
| Branch coverage | "Was each if/else taken?" | Input combinations, invariant violations |
| Mutation testing | "Do tests detect code changes?" | Semantic correctness, business rule violations |
| **Property testing** | **"Does this invariant hold for ALL inputs?"** | (Requires knowing which invariants matter) |

---

## Part 2: The Ship Confidence Framework

We propose a 4-tier model mapping test rigor to deployment risk:

### Tier 1: Side Projects / OSS Libraries

**Risk**: Low. Bugs are embarrassing, not catastrophic.

| Requirement | Target |
|------------|--------|
| Line coverage | ≥ 80% |
| Unit tests | Happy path + basic edge cases |
| Property tests | Optional but recommended |
| **Ship confidence** | "It probably works" |

**Tools**: Jest/pytest + manual review

### Tier 2: SaaS / Commercial Products

**Risk**: Medium. Bugs cost money, reputation, and user trust.

| Requirement | Target |
|------------|--------|
| Line coverage | ≥ 90% |
| Property-based testing | 1,000 random inputs per property |
| Mutation score | ≥ 70% |
| Integration tests | Critical user flows |
| **Ship confidence** | "We've tested the important paths" |

**Tools**: Jest/pytest + fast-check/Hypothesis + Stryker

### Tier 3: Fintech / Payments / Healthcare SaaS

**Risk**: High. Bugs have legal and financial consequences.

| Requirement | Target |
|------------|--------|
| Line coverage | ≥ 95% |
| Property-based testing | 10,000 random inputs + shrinking |
| Mutation score | ≥ 85% |
| Cross-function verification | Composite invariants across modules |
| Fuzz testing | Boundary/overflow/injection patterns |
| **Ship confidence** | "We can prove the critical paths are correct" |

**Tools**: Everything from Tier 2 + propcheck + custom fuzzing

### Tier 4: Aviation / Medical Devices / Autonomous Vehicles

**Risk**: Safety-critical. Bugs kill people.

| Requirement | Target |
|------------|--------|
| Standard | DO-178C (aviation), IEC 62304 (medical), ISO 26262 (automotive) |
| Coverage | MC/DC (Modified Condition/Decision Coverage) |
| Property-based testing | Exhaustive for bounded domains |
| Formal verification | SMT/SAT provers for critical components |
| Mutation score | ≥ 95% |
| **Ship confidence** | "We have mathematical proof of correctness" |

**Tools**: Everything + TLA+/Alloy/Z3/Coq

---

## Part 3: Industry Standards Deep Dive

### DO-178C — Software Considerations in Airborne Systems

The FAA requires avionics software to meet one of 5 Design Assurance Levels (DAL A through E). Level A (catastrophic failure) requires:
- MC/DC coverage: every condition in every decision independently affects the outcome
- Traceability: every requirement maps to a test
- Formal methods recommended for Level A

### IEC 61508 — Functional Safety

The standard for industrial safety systems (nuclear plants, railway signaling). Defines Safety Integrity Levels (SIL 1-4):
- SIL 3-4 recommends formal verification and property-based testing
- Requires evidence that "systematic failures" have been addressed

### ISO 26262 — Automotive Functional Safety

The standard for automotive electronics (ADAS, brake-by-wire). Defines Automotive Safety Integrity Levels (ASIL A-D):
- ASIL D requires MC/DC coverage and back-to-back testing
- Property-based testing fits the "fault injection testing" requirement

---

## Part 4: Where propcheck Fits

propcheck automates the leap from Tier 1 to Tier 2/3:

1. **Infer**: LLM reads your code and generates property definitions ($0.05 one-time cost)
2. **Run**: fast-check/Hypothesis executes 1,000-10,000 random inputs per property ($0 ongoing)
3. **Quality**: Mutation testing measures how strong your properties are
4. **CI/CD**: Auto-run on every PR via GitHub Action

```
Tier 1 → Tier 2: propcheck infer + propcheck run
Tier 2 → Tier 3: propcheck run --thorough + propcheck quality
Tier 3 → Tier 4: propcheck verify (future: SMT formal verification)
```

---

## Part 5: Call to Action

1. Run `npx propcheck` on your codebase today
2. Check your Ship Confidence tier
3. If you're shipping a SaaS product with only unit tests, you're at Tier 1 — your users deserve Tier 2

> "The first company to define a testing confidence standard will own the category."

---

## Meta

- **Word count target**: 2,000-2,500 words
- **Tone**: Technical but accessible. No marketing fluff.
- **Audience**: Senior engineers, CTOs, engineering managers
- **CTA**: Try propcheck, star the repo, share the article
- **Cross-link**: Reference the Show HN post and GitHub repo
