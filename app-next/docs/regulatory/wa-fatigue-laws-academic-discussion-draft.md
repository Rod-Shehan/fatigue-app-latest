# Hours, recovery, and record: a practical reading of Western Australia’s commercial vehicle driver fatigue regulations

**Working paper draft — academic version**

> **Disclaimer:** This document is a working paper draft for scholarly discussion. It is not legal advice. Verify all statutory thresholds and wording against the current official text of the Work Health and Safety (General) Regulations 2022 before citation in a published paper or operational use.

Discussion draft expanding Reg 184E (hours of work) and Reg 184G (record keeping) under the Work Health and Safety (General) Regulations 2022, formerly cited in industry materials as OSH Regulation 3.132. The analysis integrates the statutory structure with continuous-timeline practice as developed in electronic work-diary engineering and fatigue risk management systems (FRMS).

**Tags:** WHS Reg 184E · WHS Reg 184G · Solo / two-up / shiftwork · Doctrine labelled

> **Methodological note**
>
> Passages labelled doctrine describe operational or FRMS interpretations used to make rolling windows computable in electronic records. They are not presented as judicial holdings. Statutory thresholds (hours, counts, conjunctive wording) should be checked against the current official regulation text before citation in a published paper.

---

## 1. Introduction: fatigue law as continuous accounting

Commercial vehicle driver hours in Western Australia occupy an unusual place in the Australian regulatory landscape. They are located in the general work health and safety regulations rather than in a free-standing “diary statute” written solely for roadside enforcement. That placement shapes both the normative character of the rules and the way they must be administered in practice. The regulations do not merely prescribe a paper form; they prescribe a pattern of work time, breaks from driving, and non-work time that must be capable of demonstration over rolling periods measured in hours and days. In that sense, Reg 184E functions as a continuous accounting regime: each minute of the driver’s life on duty or off duty is assigned to a category, and compliance is the question whether those categories satisfy a set of nested windows ending at the moment of evaluation.

This paper’s practical focus is deliberate. Statutory fatigue rules are often taught as lists of maxima and minima. In operations—and especially in electronic diaries—the decisive questions are temporal: when does a window start; what minutes count toward separation; whether a calendar midnight truncates an open bout of work; how a multi-day holiday interacts with a rule that demands three discrete seven-hour non-work periods in seventy-two hours. Those questions are not always answered in the regulation’s surface text. Where industry and system designers supply answers, transparency requires that those answers be labelled as interpretive practice rather than as silent paraphrases of the Act.

Three analytical horizons must be kept distinct throughout. First, the rule windows of Reg 184E (five hours, twenty-four hours, forty-eight hours, seventy-two hours, seven days, fourteen days, twenty-eight days). Second, the record-retention horizon of Reg 184G (at least three years from the last entry). Third, the operational lookback an engine needs in memory to evaluate the longest windows at “now” (commonly on the order of weeks to a few months of prior sheets, which is an engineering choice rather than a retention standard). Conflating these horizons produces familiar errors: purging records too early because a fourteen-day rule “only needs a fortnight”; or treating a roadside produce obligation as if it exhausted the legal archive.

### 1.1 Legislative pedigree and renumbering

Industry training and older WorkSafe materials frequently refer to “OSH Regulation 3.132” when discussing commercial vehicle driver hours. Under the Work Health and Safety (General) Regulations 2022, the operative hours clause is Reg 184E, with record-keeping in Reg 184G. An academic account should treat the renumbering as continuity of substance under a new statutory architecture, not as the creation of a second regime. Readers who still cite 3.132 and readers who cite 184E are ordinarily pointing at the same policy cluster: universal break and cumulative-work rules, additional solo recovery structure, modified two-up structure, and shift-change recovery, backed by a multi-year record duty.

Situating the rules in WHS law also clarifies the duty-holder frame. Fatigue hours are not only a driver self-management checklist; they form part of how a person conducting a business or undertaking organises work that can kill or injure through impairment. The driver’s diary is simultaneously evidence of personal compliance and organisational record. That dual character explains why attestation (signature), manager amendment with reason, and inspector accessibility appear alongside the minute-by-minute arithmetic.

### 1.2 Why rolling time displaces calendar folklore

The regulation’s recurring phrase “in any … period” is the grammatical signature of a rolling standard. A fourteen-day period ending at Tuesday 15:40 is not the same object as “the fortnight printed on the payslip,” nor the same as “Sunday to Saturday on the sheet.” Calendar days, weeks, and months remain indispensable for human reading: they tell a driver which card to open and a court which page of a PDF to examine. They are descriptors of location on a continuous timeline. They are not, without more, resets of open activity or of rule windows.

Operationally, an open bout of work, break, or non-work continues until the next driver-logged event (or until end-of-shift stops carry of on-duty activity). Filling an unlogged gap at midnight as a different category without a driver event invents a discontinuity the statute does not write. Electronic systems that encode midnight or week-start as activity boundaries therefore risk systematic mis-scoring of both short-cycle break rules and medium-horizon recovery rules. The academic implication is that any serious treatment of WA CVD fatigue law must be a treatment of timeline semantics, not only of threshold numbers.

---

## 2. The categorical foundation: work, break, and non-work

Reg 184E’s architecture presupposes a trichotomy: work time, breaks from driving, and non-work time. Each limb of the regulation leans on that distinction. The five-hour rule asks about breaks inside accumulated work. The solo seventy-two-hour package asks about non-work quantity and structure. The fourteen- and twenty-eight-day rules ask about long continuous non-work. Two-up rules ask about non-work that may or may not occur in a moving vehicle. If a diary collapses break into non-work, or treats every pause as work interruption without category, the statute’s nested design cannot be evaluated.

### 2.1 Work time

Work time is the on-duty accumulation that loads the five-hour window and the fourteen-day work ceilings. In electronic practice it is derived from driver events of type “work,” expanded onto a minute grid, rather than from a single “shift start / shift end” pair alone. That expansion matters because the five-hour rule is not “five clock hours since start of shift”; it is five hours of work time. A driver who works two hours, breaks, and works three more has five hours of work for the purpose of the break rule even if six clock hours have elapsed.

End of shift (stop) and transitions into non-work terminate the accumulation of work for short-cycle purposes. Subsequent time is not “forgotten” for fourteen-day work totals; it simply ceases to be work minutes. The academic point is that “work” is a category on a tape, not a sociological description of being “on a trip.”

### 2.2 Breaks from driving

Breaks from driving are the statute’s short-cycle counterweight to work. They exist so that continuous driving bouts are interrupted by qualifying rest without necessarily resetting the driver’s whole recovery architecture. In slot-based operational models used in electronic diaries, a break qualifies toward the twenty-minute total only if it meets a minimum consecutive duration (commonly ten minutes). A single continuous break of at least twenty minutes can fill the requirement; alternatively, two separate breaks of at least ten minutes can do so. Sub-threshold fragments do not accumulate into a fiction of compliance.

**Doctrine (classification).** Systems must decide when a “break” has become long enough to be non-work recovery rather than an in-shift pause. One operational classification re-records breaks longer than thirty minutes as non-work on the minute tape. That choice is not a verbatim statutory sentence; it is a boundary rule that prevents long meal stops from remaining forever in the “break from driving” bucket while failing to feed seven-hour and twenty-four-hour non-work counters. Papers should disclose such classifications, because different electronic systems that choose different thresholds will score the same lived day differently under identical statute text.

### 2.3 Non-work time

Non-work time is the recovery category. It includes ordinary off-duty periods and, under two-up rules, certain rest that the statute expressly allows in a moving vehicle. For solo drivers, long continuous non-work is the substance of Reg 184E(2)(b); structured non-work within seventy-two hours is the substance of Reg 184E(2)(a). Unlogged time on a derived tape is commonly treated as non-work until a subsequent event reassigns the category—an assumption that must be handled carefully at cold start and after end of shift.

Because non-work is both “absence of work” and a positively counted resource (twenty-seven hours; three sevens; two twenty-fours), electronic gaps and holidays create paradoxical false failures if engines score pure green tape as “missing majors.” That paradox motivates the soft-reset and work-enlivening doctrines discussed in section 5.

---

## 3. Reg 184E(1) — duties applying to all commercial vehicle drivers

Subsection (1) states the universal floor: every commercial vehicle driver, solo or two-up, must satisfy the five-hour break discipline and the fourteen-day work ceiling. Solo and two-up regimes add structure; they do not repeal (1).

### 3.1 Reg 184E(1)(a) — five hours of work and twenty minutes of break

#### Statutory structure

For every five hours of work time, the driver must take breaks from driving totalling at least twenty minutes, including a break of at least ten consecutive minutes after five hours of work time. The drafting couples a quantitative total (≥20 minutes) with a qualitative minimum consecutive element (≥10 minutes). It is therefore insufficient to sprinkle four five-minute pauses across a bout of work: the total may look adequate on a naive sum, but the consecutive and slot logic of practical enforcement will not.

#### Practical evaluation on an event timeline

Contemporary electronic evaluation walks backward (or forward) through work segments until three hundred minutes of work are accounted for, establishing a rolling work window ending at the evaluation instant or at the moment work would continue without rest. Within that window, qualifying rest is assessed. A continuous break of at least twenty minutes completes the requirement. Otherwise, two separate qualifying breaks of at least ten minutes are required. Breaks shorter than ten minutes do not fill a slot. Returning to work after the five-hour work accumulation without completed slots is the classic breach.

End of shift, stop, and non-work reset the five-hour work block. The rule’s purpose is rest within a bout of work, not perpetual interruption of life. After a genuine recovery into non-work, a new bout of work begins a new five-hour account. That reset behaviour is why conflating “break from driving” with “non-work” matters: a misclassified long pause can either wrongly keep the five-hour clock alive or wrongly starve the recovery counters.

#### Academic implications

Teaching materials that describe the rule as “drive five hours, then break” understate the statute’s use of work time as an accumulated quantity. Comparative fatigue regimes (including national heavy vehicle standard hours) likewise distinguish work accumulation from clock time since signing on; WA’s (1)(a) belongs in that family. An expert paper can usefully contrast folk models of the shift with the regulation’s work-time arithmetic, and can note that coverage-only day grids without events support only weak proxies (for example, warning when a day shows five or more hours of work and zero break hours).

### 3.2 Reg 184E(1)(b) — not more than 168 hours of work in any 14-day period

#### Statutory structure

In any fourteen-day period, work time must not exceed 168 hours. The figure is a cumulative ceiling: it is mathematically equivalent to an average of twelve hours of work per day if every day were worked, but the regulation does not grant a daily twelve-hour entitlement. A driver may be well under 168 hours yet still breach (1)(a) or solo recovery rules; conversely, a driver who respects short-cycle breaks may still breach 168 hours through relentless multi-day loading.

#### Practical evaluation

Evaluation uses a rolling window of 20,160 minutes on a continuous work tape. The analytical difficulty is path dependence after long recovery. If every fourteen-day window in a lifetime career tape is scored without segmentation, an ancient fortnight of heavy work can remain entangled with unrelated later activity in ways that fight the intuitive meaning of a cumulative load limit after a long stand-down.

**Doctrine (168-hour segmentation).** One operational reading segments the work tape by at least forty-eight hours of continuous no-work before applying rolling fourteen-day work totals inside each segment. A forty-eight-hour recovery may end mid-day; it is not forced onto midnight. This is not the same mechanism as Reg 184E(2)(b)’s twenty-four-hour non-work periods, and it is deliberately not a twenty-four-hour soft-reset of the 168-hour account. Papers should present the forty-eight-hour segmentation as interpretive practice unless and until it is anchored in express statutory language or authoritative guidance.

Operational systems often emit a pre-breach warning (for example when rolling fourteen-day work exceeds 140 hours). Such bands are risk management overlays, not statutory thresholds. They belong in the FRMS discussion, not in the black-letter list of hours.

#### Academic implications

The 168-hour rule is the clearest illustration that WA CVD fatigue law is not exhausted by daily maxima. It invites comparison with national heavy vehicle fortnightly limits and with scientific literatures on cumulative sleep debt. It also forces record systems to retain enough history to evaluate nested windows—another bridge to Reg 184G.

---

## 4. Reg 184E(2) — additional requirements for solo driving

Where there is no relief driver, the regulation adds a recovery architecture that is more demanding than the universal floor. Two clusters dominate: the short-horizon seventy-two-hour package in (2)(a), and the medium-horizon twenty-four-hour non-work requirements in (2)(b). They share the vocabulary of non-work, but they measure different things and must not soft-reset each other.

### 4.1 Reg 184E(2)(a) — the seventy-two-hour package

#### Statutory structure as a single conjunctive package

In any seventy-two-hour period, the solo driver must have at least twenty-seven hours of non-work time, including at least three periods of at least seven consecutive hours of non-work, each separated from the next by not more than seventeen hours. The grammar is conjunctive. The three ≥7-hour periods are not an optional alternative to a large total of non-work; they are included within the requirement. Nor does a single long sleep waive the count of majors. Readings that treat the limbs as independent menus (“either 27 hours or three sevens or seventeen-hour spacing”) under-read the clause.

#### The twenty-seven-hour limb

Twenty-seven hours of non-work in seventy-two hours is a density requirement: at least three-eighths of the window must be non-work. In retrospective electronic scoring, the usual object is the single seventy-two-hour window ending at evaluation “now,” inside the timeline segment that still counts after recovery boundaries. Shortfalls below twenty-seven hours are structural warnings that the density of recovery is inadequate even before spacing is considered.

#### The three ≥7-hour majors

The majors are continuous runs of at least seven hours of non-work. They encode a preference for consolidated recovery over fragmented off-duty crumbs. Counting majors on a minute tape is sensitive to classification: a six-hour-fifty-minute sleep fails; a seven-hour sleep succeeds; a fourteen-hour sleep is still one major unless the counting rule splits by other boundaries (ordinary continuous-run counting does not split a single green run into multiple majors without interruption).

#### The ≤17-hour separation limb

Successive qualifying majors must not be separated by more than seventeen hours. The operational meaning of “separated by” is contested terrain for implementers. One rigorous reading measures elapsed time between the end of one ≥7-hour non-work period and the start of the next, counting toward that elapsed time every minute that is not non-work—work, break, and unassigned gap alike. Under that reading, a long in-shift break does not keep two majors artificially “close” when the driver has not returned to non-work recovery. Breach of the spacing limb is typically treated as a hard violation because it marks a dangerous elongation of the waking/working episode between consolidated sleeps.

Related but distinct is the operational “seventeen-hour episode” concept used in some diaries: work and break since the last ≥7-hour anchor, with consequences for whether a fresh seven-hour rest is required before resuming. That episode logic is an FRMS/UX cousin of the statutory spacing limb; it should not be silently equated with Reg 184E(2)(a)’s count of three majors in seventy-two hours.

#### Interaction with holidays and long green

A naive rolling seventy-two-hour tape that includes a multi-day holiday of unbroken non-work, followed by a short return to work, can report “found: 1 major” and look non-compliant even though the driver has been recovering. That paradox is not a reason to rewrite the conjunctive package; it is a reason to define when the package applies and when a fundamental recovery boundary ends a segment. Those questions are taken up in section 5 (soft-reset doctrine).

### 4.2 Reg 184E(2)(b)(i) — two periods of ≥24 hours non-work in any 14 days

#### Statutory structure

In any fourteen-day period, the solo driver must have at least two periods of at least twenty-four consecutive hours of non-work. These are day-scale recovery blocks. They are not the seven-hour majors of (2)(a), and they are not satisfied by aggregating shorter sleeps to forty-eight hours of fragmented off-duty time.

#### Practical evaluation

On a minute tape, a qualifying period is a continuous run of at least 1,440 non-work minutes. Floor division of a longer continuous run matters: forty-eight continuous hours of non-work is two periods of twenty-four hours, not one. Evaluation at “now” asks whether the latest fourteen days of available timeline contain at least two such periods. Historical rolling audits may still identify earlier fourteen-day gaps even when the present window is clear—an important point for organisational due diligence across a retained archive.

When electronic history is thin—new system, new driver, incomplete prior weeks—the legal need for the rests does not disappear. The practical response is attestation: the driver declares the absolute start and end of each relied-upon ≥24-hour non-work break as part of the week’s record and signs. Declarations are not a licence to invent rests; they are a way to make clear and systematic what the incomplete tape cannot yet prove. Absolute times (not merely calendar dates) matter once soft-reset and AMI-style scoring use the end instant of the most recent rest.

#### Academic implications

Option (i) is the default medium-horizon solo obligation. It operationalises a fortnightly need for full-day recovery in a rolling sense. Comparative discussion can place it alongside national requirements for continuous stationary rest, while noting WA’s distinctive packaging with the seventy-two-hour clause and the twenty-eight-day alternative.

### 4.3 Reg 184E(2)(b)(ii) — the twenty-eight-day alternative

#### Statutory structure

As an alternative, in any twenty-eight-day period the solo driver may rely on at least four periods of at least twenty-four consecutive hours of non-work, if and only if work time does not exceed 144 hours in any fourteen-day period within that twenty-eight-day period. Option (ii) is therefore a compound alternative: more day-scale rests, plus a tighter nested work ceiling (144 hours rather than 168). It is not a unilateral election to ignore fortnightly recovery.

#### Practical evaluation

Full evaluation presupposes at least twenty-eight days of timeline. The four ≥24-hour blocks use the same continuous-run logic as option (i). The 144-hour limb is checked on rolling 20,160-minute work windows inside the twenty-eight-day span; calendar fortnights are again descriptors rather than the mathematical objects. Until sufficient history exists, operational systems typically keep drivers on the two-rest / option (i) path rather than demanding four declarations prematurely.

Neither option (i) nor option (ii) should soft-reset when a twenty-four-hour break occurs: those breaks are the measured substance. Soft-resetting them would erase the counter the sub-regulation exists to enforce.

#### Academic implications

Option (ii) reveals the regulation’s willingness to trade patterns: denser day-scale recovery against a stricter cumulative work cap. It is a natural site for FRMS discussion about whether operators consciously elect the alternative or merely fall into it when history deepens. It also stresses record systems: without multi-week lookback, the alternative cannot be proven even if the lived pattern was compliant.

---

## 5. Soft-reset doctrine and the ≥24-hour fundamental break

> **Doctrine — not an express Reg 184E sentence**
>
> Reg 184E states rolling windows. It does not, in so many words, provide that a twenty-four-hour non-work break “resets” the seventy-two-hour package. The following records an intended FRMS / electronic-diary reading used so that holidays and long recovery are not scored as false shortfalls.

### 5.1 The problem soft-reset answers

Short-horizon solo rules are about the structure of recovery inside a worked pattern. If a driver takes a genuine multi-day stand-down, the continuous non-work tape is “green.” A subsequent short return to work can place evaluation “now” in a seventy-two-hour window that still contains mostly holiday green plus a thin strip of duty. Naïve major counting then reports too few ≥7-hour periods after the return, because the holiday was one continuous run rather than three post-holiday majors. Punishing that pattern fights both the protective purpose of long recovery and ordinary FRMS practice.

### 5.2 Content of the doctrine

First, timelines remain rolling; calendar labels remain descriptors. Second, work enlivenes short-horizon rest-structure rules: pure non-work with no work in the scored window should not fail for missing majors. Third, a continuous break of at least twenty-four hours of non-work—proven on the tape or attested with absolute start and end—is a fundamental recovery boundary. Soft-reset uses the end instant of that break. Fourth, the same break must not wipe Reg 184E(2)(b)’s fourteen- and twenty-eight-day counters, because those counters measure twenty-four-hour blocks.

Under this reading, the seventy-two-hour package and the ≤17-hour spacing limb are scored on the post-reset segment, when the segment is long enough and when work has enlivened the window. Absolute start and end times are preferred to calendar dates alone, because midnight is not the legal object—the end of the continuous break is.

### 5.3 What soft-reset does and does not clear

| Domain | Soft-reset after ≥24h continuous NW? |
| --- | --- |
| 184E(2)(a) 72h package (27h + 3×7h + ≤17h) | Yes (doctrine) |
| 184E(2)(b)(i) 2×24h in 14 days | No |
| 184E(2)(b)(ii) 4×24h in 28 days | No |
| 184E(1)(a) 5h / 20 min breaks | No |
| 184E(1)(b) 168h work / 14 days | Not via 24h (separate 48h segmentation doctrine) |
| 184E(4) pattern-change gap | Separate use of 24h as required gap |

Academically, soft-reset should be argued as purposive interpretation and FRMS necessity, openly, rather than smuggled into a paraphrase of the regulation. Critics may prefer a stricter literalism that scores every rolling seventy-two hours of tape without segment resets; the paper’s contribution is to make the stakes of that choice visible.

---

## 6. Reg 184E(3) — two-up driving with a relief driver

Two-up operation changes the recovery geometry. The presence of a relief driver allows rest in a moving vehicle for some limbs, while still requiring stationary recovery under others. The drafting is an either–or between a forty-eight-hour stationary major and a seven-day structural package, sitting atop a universal twenty-four-hour non-work floor.

### 6.1 Reg 184E(3)(a) — ≥7 hours non-work in any 24-hour period

In any twenty-four-hour period, the two-up driver must have at least seven hours of non-work time, which may be taken in a moving vehicle. Practically, this is a rolling floor: whenever a twenty-four-hour window contains duty activity, the non-work minutes in that window must meet the seven-hour minimum. It is the two-up analogue to a daily density of recovery, tolerant of sleeper-cab rest that solo rules would not treat the same way.

Electronic evaluation typically flags a violation when a rolling twenty-four-hour window with work or break data contains fewer than seven hours of non-work. Windows with no duty data are usually skipped so that pure off-duty days are not false alarms.

### 6.2 Reg 184E(3)(b)(i) — ≥7 hours continuous non-work not in a moving vehicle in any 48 hours

Limb (i) requires, in any forty-eight-hour period, at least one period of at least seven continuous hours of non-work that is not spent in a moving vehicle. It is the stationary major that balances the permission, in (3)(a), to take some non-work while the vehicle moves.

In operational systems that first test the seven-day alternative (3)(b)(ii), limb (i) is enforced when that alternative is not met: a rolling forty-eight-hour window with duty data and no ≥7-hour non-work block becomes the breach path. Escalation to a hard “moving vehicle” finding depends on evidence. Without a reliable classifier, systems may warn to enable location services and only elevate when GPS drift during purported rest exceeds a heuristic threshold. Academically, this is an evidence problem under Reg 184G’s demand for clear records, not a solved telematics standard unless a particular accreditation scheme says otherwise.

### 6.3 Reg 184E(3)(b)(ii) — the seven-day structural alternative

Limb (ii) offers a weekly architecture: in any seven-day period, at least forty-eight hours of non-work not spent in a moving vehicle, including at least twenty-four consecutive hours, and without any non-work period shorter than seven consecutive hours. The last element is a ban on recovery crumbs: short off-duty fragments that would inflate totals without consolidated rest.

Practical scoring therefore checks three warnings or defects under the alternative: insufficient total non-work; missing ≥24-hour continuous block; presence of any non-work run under seven hours. If the alternative fails as a package, the system falls through to the forty-eight-hour stationary major of (b)(i). The academic interest is the regulation’s use of structured alternatives rather than a single numeric maximum—an approach that rewards pattern quality, not only hour totals.

---

## 7. Reg 184E(4) — shiftwork and changes of shift pattern

### 7.1 Statutory structure and the meaning of “five consecutive days”

If the driver is engaged in shiftwork on five or more consecutive days, there must be at least twenty-four continuous hours of non-work between shift changes. The clause targets circadian and social disruption from flipping between incompatible duty patterns (for example, day-oriented versus night-oriented work) after a sustained run on one pattern.

**Operational reading of “days.”** Legislation speaks in days; continuous electronic enforcement commonly treats five consecutive days as five × twenty-four hours = 120 hours (7,200 minutes) on the same labelled pattern on the rolling timeline. Drivers record pattern labels (Day/Night or A/B) on day cards. After the threshold, a change of pattern is measured as elapsed time from End shift to the next Work event. The required ≥24-hour gap may fall anywhere on the clock; alignment with midnight is neither required nor presumed. Day cards remain the human and PDF descriptor of where the change sits.

This use of twenty-four hours is a required inter-pattern gap. It is conceptually distinct from soft-reset’s use of ≥24-hour continuous non-work to clear short-horizon solo scoring. A paper that conflates the two will mislead practitioners.

### 7.2 Evidentiary and educational dimensions

Pattern-change compliance fails closed when End shift or subsequent Work times are missing: the gap cannot be proven. Proactive education when a driver approaches 120 hours on the same pattern is an FRMS overlay that does not alter the black-letter gap once a change occurs. Only work (in some engine paths) interrupts the counting of pattern-change rest, reinforcing that the gap is about non-work between patterns, not about renaming a day card without recovery.

---

## 8. Reg 184G — record keeping for commercial vehicle drivers

### 8.1 Content and duration of the record

Reg 184G requires records covering work time, breaks from driving, and non-work time; retention for at least three years from the date of the last entry; and records that are clear, systematic, and accessible to an inspector on request. The trichotomy of 184E thus reappears as a documentary duty: a record that cannot distinguish the three categories cannot demonstrate compliance with the hours clause.

In electronic practice, the weekly attested sheet—events, derived minute coverage, declared rests where relied upon, crew and pattern metadata, and signature—is the unit of legal record. Exports and archives exist so that three-year retention survives application churn. Driver attestation locks a week as a statement that the record is true; manager amendment after lock is an audited correction that ordinarily requires re-attestation.

### 8.2 Retention, lookback, and roadside produce distinguished

Retention answers how long the record keeper must keep the archive. Rule lookback answers how much past activity an engine loads to score Reg 184E at “now.” Roadside produce (under national diary practice, often on the order of twenty-eight days) answers what the driver must be able to show at the roadside. WA Reg 184G’s three-year duty is not reduced by the length of a compliance lookback buffer, nor by a roadside window. Parallel national heavy vehicle record-keeping (HVNL s 341) likewise uses a three-year horizon with “made or received” language; interstate operators should be told that WA hours logic and national retention duties can apply in parallel rather than in conflict.

### 8.3 Clarity, declarations, and absolute times

Where the continuous tape cannot yet prove a ≥24-hour non-work period, attested declarations with absolute start and end times are a way of meeting 184G’s clarity demand without inventing events. Calendar-only dates are weaker for soft-reset and for AMI-style absolute tapes because they reintroduce day descriptors where the regulation’s logic is continuous. Signing the week converts those declarations into part of the driver’s legal statement.

---

## 9. Compliance, prospective risk, and FRMS

Retrospective Reg 184E evaluation applies to the attested record of what was logged. Forward-looking exposure—declared future distance and duty time projected against rolling state—is risk analysis. It may use the same numeric thresholds as the regulation for intelligibility, but it does not create a past violation on unlogged future work. Keeping those families separate is essential in electronic systems and in academic writing: otherwise every planning tool becomes a false compliance engine, or every compliance engine pretends to predict the future.

FRMS literature (two-process sleep models, sawtooth alertness, ISO 31000 risk process) can illuminate why WA’s package looks the way it does: short-cycle breaks against continuous driving pressure; consolidated seven-hour majors against fragmented wakefulness; day-scale twenty-four-hour blocks against cumulative debt; shift-change gaps against circadian inversion. The regulation remains a legal floor; FRMS remains the organisational method for managing residual risk above that floor.

---

## 10. Synthesis for scholarly use

### Claim set suitable for an expert paper

1. WA CVD hours are a rolling, categorical accounting regime under WHS regulations, continuous with older OSH 3.132 citations.
2. Calendar days and weeks are descriptors; treating them as activity resets is a category error relative to “in any … period” drafting.
3. Reg 184E(1) supplies universal break and cumulative-work floors; (2)–(4) add solo, two-up, and shiftwork structure.
4. Reg 184E(2)(a) is one conjunctive package; (2)(b) measures day-scale non-work and must not be soft-reset by the breaks it counts.
5. Soft-reset after ≥24h continuous non-work is purposive / FRMS doctrine for short-horizon solo scoring, and should be argued openly.
6. Two-up law turns on moving versus stationary rest—an evidence problem as much as an arithmetic one.
7. Reg 184G makes the trichotomy documentary and sets a three-year archive distinct from rule lookback and roadside produce.

### Suggested section map for the finished article

| Article section | Primary provisions |
| --- | --- |
| Legislative setting and renumbering | WHS framework; 3.132 → 184E/G |
| Categories and timeline semantics | Definitions; rolling time |
| Universal duties | 184E(1)(a)–(b) |
| Solo short-horizon recovery | 184E(2)(a); soft-reset doctrine |
| Solo medium-horizon recovery | 184E(2)(b)(i)–(ii) |
| Two-up | 184E(3)(a)–(b) |
| Shiftwork pattern change | 184E(4) |
| Records and proof | 184G; declarations; attestation |
| FRMS and prospective risk | Beyond black-letter |
| Open questions | Classification thresholds; lifetime audit |

---

*Draft basis: Circadia regulatory documentation (wa-commercial-vehicle-hours, 24h-soft-reset-doctrine, record-retention-and-compliance-lookback), compliance engines and related modules, owner rolling-timeline rules, and prior implementation discussions. Confirm all thresholds against the current WA Work Health and Safety (General) Regulations 2022 before publication.*
