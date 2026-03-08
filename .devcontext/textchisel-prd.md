# **textchisel**

## Product Requirements Document

_Inverse Kinematics for Prompt Space_

v0.2 — March 2026

**CONFIDENTIAL**

---

## 1. Vision

> _"The sculptor's hand can only break the spell that the marble holds within."_
>
> — attributed to Michelangelo

textchisel is a tool that lets people **navigate the space of possible prompts** the way a sculptor navigates a block of stone: by revealing structure that was always latent, one deliberate cut at a time. The user defines the dimensions of quality that matter to them, and the app makes those dimensions visible, measurable, and independently adjustable — while a hidden intelligence layer handles the thousands of micro-decisions (word choice, sentence structure, rhetorical strategy) that actually implement each adjustment.

The result is a prompt whose properties the user can see, understand, and control — without needing to understand prompt engineering, linguistic theory, or the internal mechanics of large language models.

## 2. The Problem

Prompting an LLM today is like operating a robot arm by adjusting each joint angle individually — shoulder rotation, elbow flexion, wrist pitch — and hoping the hand ends up where you want it. The space of all possible prompts is astronomically large. The relationship between a prompt's structure and its output quality is nonlinear, context-dependent, and opaque. Users have no map, no compass, and no vocabulary for describing where they are or where they want to go.

The consequences are familiar to anyone who has used an LLM seriously:

- **Trial and error dominates.** Users tweak wording, regenerate, compare, tweak again. There is no systematic way to explore the space. Most users converge on a "good enough" result because they have no way to know what "better" looks like from where they stand.

- **Quality is invisible.** A prompt may score well on clarity but poorly on persuasiveness. The user cannot see these dimensions, let alone trade them off deliberately. Improvement on one axis often silently degrades another.

- **Expertise is inaccessible.** The people who write the best prompts have an intuitive understanding of rhetoric, pragmatics, and model behavior that cannot be transferred through tip sheets or prompt libraries. The gap between novice and expert remains enormous.

- **Iteration is unstructured.** There is no record of what was tried, what worked, what the trade-offs were. Each edit is a blind step. Over a long session, users forget why they made earlier choices and often regress.

The core problem is not that users lack skill. It is that the _space itself_ is illegible. textchisel makes the space legible.

## 3. The Solution: How It Works

textchisel decomposes the problem of "write a good prompt" into three separable concerns, each handled by a different layer of the system.

### 3.1 The User Layer: Dimensions and Sliders

The user describes what they want in natural language. The system proposes a set of **dimensions** — named axes of quality like "urgency," "scientific rigor," or "allegorical opacity" — that capture what matters for this particular prompt. Each dimension comes with a **rubric**: a measurement system that defines what each position on the axis means. The user sees these dimensions on a spider chart and can adjust them via sliders.

Crucially, the user can **lock** any dimension at its current value. This fixes that aspect of the prompt and frees the user to explore another dimension in isolation. The workflow is: fix all but one → explore that one → lock it → free another → repeat. Through this cycle, the user converges on a prompt that simultaneously satisfies targets across all dimensions.

### 3.2 The Grammar Layer: Hidden Mechanics

Beneath the user-facing dimensions lies a **grammar layer** — a structured vocabulary of prompt mechanics that the system uses internally. This layer understands pragmatic acts (CONSTRAIN, EXEMPLIFY, AUTHORIZE), rhetorical modes (calibrating, mimetic, adversarial), lexical strategies (hedging, specificity, register), and syntactic patterns. When the user drags "scientific rigor" from 0.3 to 0.7, the grammar layer knows _how_ to implement that: tighten constraints, add calibrating language, increase domain-specific terminology, shift rhetorical mode from narrative to analytical.

The user never sees this layer. It is the system's internal language for translating slider positions into actual prompt modifications.

### 3.3 The Evaluation Layer: Scoring and Feedback

After each regeneration, the system scores the new prompt against every dimension's rubric using LLM-as-judge evaluation. The spider chart updates. The user sees not just the new prompt text, but a quantified portrait of how it performs on every axis they care about. This closes the feedback loop and makes each sculpting move legible.

## 4. The Governing Analogy: Inverse Kinematics

The design of textchisel is deeply informed by a single analogy from robotics: **inverse kinematics (IK)**. This analogy is not decorative; it actively shapes architectural decisions, predicts failure modes, and suggests features. A supplementary analogy from statistical mechanics — the free energy landscape — informs reasoning about the global topology of prompt space. Together, these two frameworks provide a complete vocabulary for the product's design.

### 4.1 The Primary Analogy: Inverse Kinematics

A robot arm has many joints — shoulder, elbow, wrist, each with rotational degrees of freedom. These are the _microscopic variables_, analogous to the grammar layer's lexical choices, rhetorical moves, and syntactic patterns. No operator adjusts joints directly. Instead, they control the **end effector** — the position of the hand in space. This is a small number of meaningful coordinates (x, y, z, and perhaps orientation), analogous to the user's dimensions on the spider chart.

**Inverse kinematics** is the computational problem of determining which joint angles achieve a given end-effector position. This is exactly what the grammar layer does: given target values on the user's dimensions, find the prompt structure (the "joint configuration") that realizes those targets. The user grabs the hand and moves it; the system figures out how to bend the arm.

### 4.2 What the Analogy Predicts

The IK framework makes concrete, actionable predictions about the product's behavior.

- **Many-to-one mapping and redundancy.** A robot arm with 7 joints moving a hand in 3D space has infinite solutions — many joint configurations put the hand in the same place. Similarly, many different prompt structures can achieve the same dimension scores. The grammar layer picks among them, preferring the solution closest to the current configuration. This preserves continuity: a small slider adjustment produces a small prompt change, not an arbitrary restructuring.

- **The workspace and its boundaries.** Not every end-effector position is reachable. The set of achievable positions — the workspace — has a boundary. Some dimension-value combinations are naturally achievable, some are at the boundary of what prompt space can support, and some are flatly impossible ("maximally formal" and "maximally conversational" simultaneously). The app must communicate workspace boundaries to the user, showing not just where they are but where they can and cannot go.

- **Singularities are phase transitions.** In robotics, a singularity is a configuration where a small change in end-effector target requires an infinitely large change in joint angles — the arm "locks up" or must completely reconfigure. This is precisely the phase transition problem: the user slides "formality" smoothly upward and at some point the entire prompt architecture must flip because the current structure can't support a higher value. In IK, singularities are well-studied, and the analogy imports a mature engineering vocabulary for detecting and navigating them.

- **The Jacobian captures coupling.** In robotics, the Jacobian matrix relates small changes in joint angles to small changes in end-effector position. Its structure reveals which end-effector coordinates are coupled: if moving in x unavoidably shifts y, the Jacobian tells you. The app's dimension-coupling problem is literally a Jacobian analysis. The system should compute and display this coupling, telling the user "moving scientific rigor up will likely move motivational intensity down" — and quantifying how much.

- **Manipulability captures adaptive sensitivity.** Near a singularity, the arm loses dexterity — small end-effector movements require large joint changes, and the system becomes fragile. Far from singularities, the arm is dexterous and responsive. The manipulability measure (a function of the Jacobian) quantifies this. For the app: in some regions of dimension-space, small slider movements produce large, reliable prompt changes (high manipulability). In other regions, the system struggles to respond (low manipulability). Sliders should be more granular where manipulability is low and coarser where it is high.

- **Locking is constraining end-effector coordinates.** When the user locks a dimension, they fix one coordinate of the end effector and ask to move another. This is a constrained IK problem — a standard formulation. The remaining freedom is the null space of the constraint: the set of moves the system can make without disturbing the locked coordinates. This concept directly defines what the user's slider controls when other dimensions are locked.

- **Multiple solutions are alternative architectures.** An IK problem with a redundant arm typically has multiple distinct solutions. The user is currently in one of them. Moving to a different solution requires a large reconfiguration. The app could detect the existence of alternative IK solutions and offer them: "Have you considered a completely different prompt structure that hits the same targets?"

- **The target emerges through interaction.** In IK, the user doesn't minimize a scalar function — they position a hand in multi-dimensional space. The target isn't specified in advance; the user discovers it by moving the hand, feeling where the arm responds fluidly and where it resists. This is exactly the sculpting experience: the user's intent crystallizes through the act of exploring the workspace.

### 4.3 The Supplementary Analogy: Free Energy Landscapes

A second analogy from statistical mechanics complements the IK framework by addressing the _global topology_ of prompt space — structure that IK's local vocabulary cannot describe.

In statistical mechanics, a molecular system has thousands of atomic coordinates. Physicists define **collective variables** — low-dimensional projections that capture meaningful degrees of freedom. The **free energy** as a function of a collective variable is computed by integrating out all the microscopic degrees of freedom: for each value of the collective variable, the system searches over all possible configurations that realize it and reports the best achievable energy.

In textchisel, the grammar layer performs this integration. For any slider position, it searches the space of prompt structures that realize that dimension value and produces the best prompt it can find. The user sees a smooth, interpretable landscape. The system is doing massive hidden optimization behind the scenes.

The free energy framework contributes concepts that the IK analogy does not provide:

- **Good vs. bad dimensions.** A good collective variable captures a slow, coherent mode of the system. A bad one mixes unrelated motions and produces a rugged, uninformative landscape. The system should detect when a user-defined dimension is a "bad collective variable" — one that produces erratic scoring and couples too many unrelated prompt features — and suggest decomposing it into cleaner axes.

- **Metastability and basins.** Free energy surfaces can have multiple basins separated by barriers. A user may sculpt a prompt into a local basin that scores well but isn't the global optimum. This extends the IK "multiple solutions" concept with topological richness: basins have depth (how stable the local optimum is), width (how much slider room the user has before hitting a barrier), and connectivity (how to get from one basin to another).

- **Timescale separation.** In the Born-Oppenheimer approximation, fast degrees of freedom adjust instantly to slow ones. The grammar layer (fast) must equilibrate at compute speed while the user (slow) moves at human speed. If regeneration takes too long (>10 seconds), this separation breaks and the sculpting metaphor collapses.

### 4.4 How the Two Analogies Work Together

The IK analogy governs the _interaction model_: how the user moves, what they feel, what coupling and constraints mean, how the system responds to direct manipulation. It provides the computable quantities (Jacobian, manipulability, null space, workspace boundary) that drive UX decisions.

The free energy analogy governs the _backend architecture_: how the grammar layer searches prompt space, what makes a dimension "good," how the system detects that the user is in a local optimum and could benefit from a structurally different approach. It provides the topological vocabulary (basins, barriers, ruggedness) that drives scoring and optimization decisions.

In a single sentence: **textchisel is an inverse kinematics solver for prompt space, where the user's dimensions are end-effector coordinates, the grammar layer is the joint mechanism, and sculpting is guiding the hand through the workspace one coordinate at a time — over a free energy landscape that the system navigates on the user's behalf.**

## 5. Core Concepts

### 5.1 Dimensions

A **dimension** is a named axis of quality that the user cares about for a particular prompt task. In the IK analogy, dimensions are the coordinates of the end effector — the meaningful degrees of freedom that the user can directly see and manipulate. Dimensions are not universal; they emerge from the intersection of the user's intent, the genre of the content, and the audience. A cold sales email generates different dimensions than a literary short story.

Dimensions can be introduced in three ways:

- **System-generated.** Based on the user's initial input, the system proposes 3–5 dimensions it considers most relevant. The user can accept, reject, or modify these.

- **User-defined.** The user specifies dimensions in their own language. The system maps these to internal representations and validates their independence.

- **Emergent.** As the user iterates, the system observes patterns in their edits and annotations and suggests new dimensions. ("I notice you keep tightening logical flow between paragraphs. Would you like a 'logical cohesion' dimension?")

The system should analyze user-defined dimensions for **orthogonality** — the IK equivalent of checking whether end-effector coordinates are independent or redundant. If two dimensions are highly correlated (the Jacobian reveals coupled columns), the system should notify the user and suggest either merging them or redefining them as more independent axes. The user should also be able to define **constraints** across dimensions: "motivational intensity must never drop below 0.4 regardless of what else I adjust."

### 5.2 Rubrics (Measurement Units)

Every dimension requires a **rubric**: a definition of what each position on the slider means and how the system should measure it. Rubrics are not a one-size-fits-all 0-to-1 scale. Different dimensions demand qualitatively different kinds of measurement. The richness and precision of rubrics is one of the app's most distinctive features.

The system generates rubrics automatically when it proposes dimensions, and the user can inspect, modify, or replace them. Rubric types observed across use cases include, but are not limited to:

- **Ordinal scales anchored by linguistic markers.** Discrete levels defined by the presence of specific language patterns. Example: Urgency — Level 1 (no temporal language) through Level 5 (scarcity/loss framing with specific deadlines).

- **Count-based metrics.** Raw integer counts of identifiable features. Example: Personalization Depth — count of verifiable, recipient-specific claims woven into the argument structure.

- **Taxonomic ladders of speech act types.** Classification of communicative moves against a hierarchy. Example: Ask Directness — from implicit suggestion through open question, specific proposal, forced choice, to presumptive close.

- **Extremum detection.** Scored by the most extreme instance rather than the average. Example: Abstraction Altitude — the lowest-level artifact present (analogy, pseudocode, real code, production code). The floor defines the score.

- **Graph-theoretic measures.** Structural properties of the text's organization. Example: Narrative Threading — model sections as nodes, explicit connectors as edges, score = edge density relative to maximum.

- **Ratio-based annotation density.** A ratio computed over a classification of every sentence. Example: Epistemic Transparency — (claims carrying hedges, citations, or uncertainty markers) / (total claims).

- **Simulated reader comprehension thresholds.** The evaluator models a hypothetical reader and estimates at what point in the text a parallel or meaning becomes identifiable. Example: Allegorical Opacity — at what percentage of text consumed could a naive reader identify the real-world referent?

- **Narratological mode classification.** Categories drawn from narrative theory. Example: Character Interiority — weighted centroid across external action, reported thought, free indirect discourse, interior monologue, stream of consciousness.

- **Dialectical completeness taxonomies.** Philosophical classification of how a text handles moral or intellectual tension. Example: Moral Resolution — thesis only, agonal with victor, Hegelian synthesis, or sustained aporia.

- **Function topology classification.** Mathematical classification of structural patterns. Example: Temporal Architecture — classify the narrative-order-to-chronology mapping as linear, circular, fractal, or labyrinthine.

This diversity is essential. A system that reduces every dimension to a generic 0–1 score sacrifices exactly the specificity that makes evaluation meaningful. The rubric _is_ the dimension's identity.

### 5.3 The Spider Chart and Locking Mechanism

The spider chart is the user's primary instrument of navigation. Each spoke represents a dimension — a coordinate of the end effector. The current prompt's scores define a polygon. The user's target scores define another polygon (which may be partially specified). The gap between the two is what the sculpting process closes.

The **locking mechanism** is the core interaction. In IK terms, locking a dimension constrains one coordinate of the end effector: subsequent regenerations must maintain that score (within tolerance). The remaining unlocked dimensions define the **null space** — the set of prompt modifications the system can make without disturbing the locked values. The user's workflow is: unlock one dimension, explore it with the slider, evaluate, lock it, unlock another, repeat.

Locking is not limited to whole dimensions. The user should also be able to lock at finer granularity: lock a specific phrase ("keep this exact sentence"), lock an intent ("keep the adversarial framing here but allow rewording"), lock a structural feature ("keep the three-part structure"). These finer locks are additional constraints on the joint configuration itself, and the system must reconcile them with dimension-level locks.

### 5.4 The Sculpting Workflow

The full sculpting cycle proceeds as follows:

1. The user provides an initial natural-language description of what they want.

2. The system generates an initial prompt, proposes dimensions with rubrics, and scores the initial prompt on each dimension.

3. The user reviews the spider chart and identifies the dimension furthest from their target.

4. The user locks all other dimensions and adjusts the target slider for the unlocked dimension.

5. The system regenerates the prompt, honoring all locks while optimizing the free dimension toward the target. This is a constrained IK solve: find a new joint configuration (prompt structure) that moves one end-effector coordinate while holding the others fixed.

6. The system rescores and updates the spider chart. The user evaluates the result.

7. The user may accept (lock this dimension at its new value), reject (revert), or fine-tune.

8. Repeat from step 3 until all dimensions are at target or the user is satisfied.

This cycle mirrors Gibbs sampling with a human pilot: each conditional distribution (the landscape of one dimension given all others fixed) is explored deliberately rather than stochastically. The IK solver ensures continuity — each step produces the minimum-change prompt that achieves the new target.

## 6. Examples Across Cognitive Difficulty

The following examples demonstrate how the system adapts to tasks of varying complexity. They progress from simple, near-surface dimensions with pattern-matchable rubrics to deeply entangled dimensions requiring sophisticated evaluation epistemologies. **The same interface — spider chart, sliders, lock buttons — must serve all of them.** Complexity lives entirely in the hidden layers.

### 6.1 Easy: Cold Outreach Email to an Investor

The dimensions here are pragmatic and functional — they describe what the text does to the reader. Rubrics rely on surface-level linguistic features that an evaluator can identify by pattern-matching.

**Example 1: Cold Investor Email**

**User input:** _Write a cold email to a Series B investor about our AI infrastructure startup._

| Dimension                 | Rubric / Measurement                                                                                                                                                                                               | Rubric Type                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **Urgency**               | Ordinal scale anchored by linguistic markers. Level 1: no temporal language. Level 2: soft framing. Level 3: bounded windows. Level 4: specific deadlines. Level 5: scarcity/loss framing. Score = dominant level. | _Ordinal / linguistic marker_ |
| **Personalization Depth** | Count of verifiable, recipient-specific claims woven into argument structure (not mail-merge tokens). Score = raw integer count (0 = template, 5+ = deeply researched).                                            | _Count-based integer_         |
| **Ask Directness**        | Taxonomic ladder of speech act types: implicit suggestion → open question → specific proposal → binary forced choice → presumptive close. Score = which rung the CTA lands on.                                     | _Speech act taxonomy_         |

_Why this is easy:_ The dimensions are close to the user's existing vocabulary. Someone writing a sales email already thinks in these terms. Rubrics are surface-readable. Dimensions are relatively independent — the Jacobian is nearly diagonal. The evaluator needs no specialized knowledge.

_IK behavior:_ The workspace is large and obstacle-free. The arm has ample dexterity throughout (high manipulability). No singularities are expected within typical slider ranges. The IK solver will find smooth, intuitive solutions for any target the user sets.

### 6.2 Easy–Medium: Product Landing Page Copy

The dimensions here are commercial and persuasive — they describe how the text positions a product in the reader's mind. Rubrics begin to involve reader-modeling rather than pure pattern-matching.

**Example 2: SaaS Landing Page**

**User input:** _Write landing page copy for a project management tool targeting engineering managers at mid-size companies._

| Dimension                | Rubric / Measurement                                                                                                                                                                                                                                                          | Rubric Type                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Benefit Specificity**  | Classification of each value proposition: vague ("save time") → comparative ("2x faster than spreadsheets") → quantified ("reduce sprint planning from 4 hours to 45 minutes") → evidence-backed (quantified + case study or testimonial). Score = lowest-tier claim present. | _Categorical ladder_          |
| **Objection Preemption** | Count of distinct buyer objections implicitly addressed. Each must be a real objection (cost, switching cost, learning curve, integration friction) addressed without naming it as an objection. Score = count.                                                               | _Count-based with validation_ |
| **Authority Signaling**  | Density ratio: (sentences containing social proof, credentials, or endorsement) / (total sentences). Low = pure assertion. High = densely credentialed.                                                                                                                       | _Ratio / density_             |

_Why easy–medium:_ The dimensions require the evaluator to model a buyer's psychology (what counts as a "real objection"?) rather than just scanning for linguistic patterns. But the dimensions are still relatively independent and the domain is familiar.

_IK behavior:_ The Jacobian shows mild off-diagonal terms: increasing Benefit Specificity slightly constrains Authority Signaling (evidence-backed claims demand credible sources, which interacts with the authority dimension). The workspace has soft boundaries — extreme values on all three dimensions simultaneously may be unreachable because a short landing page can't carry maximum evidence, maximum objection coverage, and maximum social proof.

### 6.3 Medium: Technical Tutorial Article

The dimensions here are cognitive and structural — they describe how knowledge is organized and transmitted. Rubrics require analyzing the text's architecture, not just its surface features.

**Example 3: Vector Database Deep-Dive**

**User input:** _Write a deep-dive blog post for senior engineers explaining how vector databases work._

| Dimension                  | Rubric / Measurement                                                                                                                                                                                                                                  | Rubric Type                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Abstraction Altitude**   | Floor detection: scored by the lowest-level artifact present. Pure analogy → conceptual diagram → pseudocode → real code with named libraries → production-grade implementation. Score = floor, not average.                                          | _Extremum detection_              |
| **Narrative Threading**    | Graph-theoretic: model sections as nodes, explicit logical connectors as directed edges. Threading = edge density / maximum possible edges. Chain = 1.0 (every section depends on previous). Disconnected = 0.0 (any section readable independently). | _Graph density metric_            |
| **Epistemic Transparency** | Annotation density ratio: (claims carrying a hedge, simplification flag, citation, or confidence qualifier) / (total factual claims). Textbook voice ≈ 0.05. Deeply honest explainer ≈ 0.35.                                                          | _Ratio over classified sentences_ |

_Why medium:_ The dimensions interact non-obviously. High abstraction altitude combined with high narrative threading is difficult to achieve because deep implementation details resist smooth narrative flow. The rubrics require structural analysis and sentence-level classification, not surface pattern-matching. The evaluator needs technical literacy.

_IK behavior:_ The workspace has a genuine boundary: the combination "production-grade code" + "perfect threading" + "high epistemic transparency" may be unreachable because production code resists narrative flow and honest hedging. The Jacobian shows significant off-diagonal coupling between Abstraction Altitude and Narrative Threading. Manipulability drops as all three dimensions approach their maxima simultaneously, meaning the user will feel the sliders become "sticky" near the workspace boundary.

### 6.4 Medium–Hard: Lesson Plan for a Conceptually Difficult Topic

The dimensions here are pedagogical — they describe how a text scaffolds understanding in a learner's mind. Rubrics require modeling a learner's cognitive state as it evolves through the text.

**Example 4: Teaching Entropy to High Schoolers**

**User input:** _Create a lesson plan that teaches the concept of entropy to 11th-grade physics students with no prior exposure to thermodynamics._

| Dimension                     | Rubric / Measurement                                                                                                                                                                                                                                                                                                                      | Rubric Type                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Misconception Inoculation** | Catalog known misconceptions about entropy ("entropy = disorder," "entropy always increases everywhere," "entropy is energy"). For each, check whether the text proactively surfaces and corrects it vs. leaves it unaddressed. Score = fraction of cataloged misconceptions addressed before the learner would naturally encounter them. | _Checklist coverage against external knowledge base_ |
| **Cognitive Load Gradient**   | Rate each paragraph's conceptual density (number of new terms, abstract relationships, and non-intuitive claims). Plot density vs. position. Score = smoothness of the gradient. Ideal: monotonically increasing with no spikes. Penalize sudden jumps or early overload.                                                                 | _Time-series smoothness analysis_                    |
| **Transfer Scaffolding**      | Count the number of explicit bridges from the taught concept to novel contexts the student hasn't seen (application to biology, to information theory, to everyday life). Each bridge must involve genuine transfer, not just naming another domain. Score = count of valid transfer bridges.                                             | _Count with semantic validation_                     |

_Why medium–hard:_ Rubrics require modeling a learner's mind (what is "cognitive load" for a specific audience?). The evaluator must reference an external knowledge base of misconceptions. The time-series smoothness rubric introduces a mathematical structure (gradient analysis) over pedagogical content. Dimensions interact: high misconception inoculation early in the text increases cognitive load, potentially violating the gradient constraint.

_IK behavior:_ The Jacobian reveals a fundamental tension: the Misconception Inoculation and Cognitive Load Gradient columns are anti-correlated. Addressing misconceptions early (which the rubric rewards) front-loads conceptual density (which the gradient penalizes). The IK solver must navigate this coupling carefully, and the app should warn the user when these dimensions are in tension. There may be a singularity — a point where the only way to increase inoculation without spiking cognitive load is to completely restructure the lesson plan.

### 6.5 Hard: Legal Negotiation Clause

The dimensions here are normative and strategic — they describe the legal and power-dynamic properties of contractual language. Rubrics require legal reasoning and game-theoretic analysis.

**Example 5: Indemnification Clause**

**User input:** _Draft an indemnification clause for a SaaS vendor agreement where we (the vendor) want to limit our liability exposure while keeping the clause palatable to enterprise procurement teams._

| Dimension                    | Rubric / Measurement                                                                                                                                                                                                                                                                                                                               | Rubric Type                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Liability Exposure**       | Enumerate all trigger events that would activate the indemnification obligation. For each, classify scope: unlimited, capped at contract value, capped at fees paid in trailing 12 months, or excluded. Score = weighted breadth (more triggers with broader scope = higher exposure). This is an inverse dimension: the user likely wants it low. | _Enumeration with weighted classification_ |
| **Procurement Palatability** | Simulated red-flag analysis: model a conservative enterprise procurement reviewer reading the clause. Count provisions that would trigger a redline request (mutual vs. one-way, carve-outs, cap structure, knowledge qualifiers). Score = expected number of redlines. Lower = more palatable.                                                    | _Simulated adversarial review_             |
| **Interpretive Precision**   | Ambiguity audit: count terms that could support more than one reasonable interpretation in litigation ("material," "reasonable efforts," "substantially"). For each, check if a definition or qualification narrows the interpretation space. Score = (ambiguous terms – defined terms) / total legal terms.                                       | _Ambiguity ratio with definitional offset_ |

_Why hard:_ Every dimension is adversarial — it models a counterparty's response. Liability Exposure requires enumerating hypotheticals. Procurement Palatability requires simulating a hostile reader. Interpretive Precision requires legal expertise to identify ambiguity. And the dimensions are deeply coupled: reducing liability exposure (narrower language) often reduces procurement palatability (more redlines) and vice versa.

_IK behavior:_ The workspace is severely constrained. Low Liability Exposure and high Procurement Palatability are nearly opposite directions in prompt space — the Jacobian reveals that their columns point in opposing directions, creating a narrow corridor of feasible positions. Manipulability is low throughout this corridor, meaning every slider adjustment is delicate and high-stakes. The app should automatically increase slider granularity in this region and display the coupling prominently. There are multiple distinct IK solutions — structurally different clause architectures (mutual vs. one-way, cap-and-carve-out vs. aggregate limit) that achieve similar scores through different mechanisms.

### 6.6 Hard: Literary Short Story as Political Allegory

The dimensions here are aesthetic and philosophical — they describe deep meaning-making structures in literary fiction. Rubrics require fundamentally different evaluator competencies, from reader simulation to narrative theory to dialectical philosophy.

**Example 6: Borgesian Surveillance Allegory**

**User input:** _Write a short story that works as a political allegory about surveillance capitalism, in the style of Borges — where the allegorical meaning is present but not obvious._

| Dimension                 | Rubric / Measurement                                                                                                                                                                                                                                                                      | Rubric Type                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Allegorical Opacity**   | Simulated reader comprehension threshold. Model a naive reader (no knowledge of surveillance capitalism). Estimate: at what percentage of text consumed could this reader identify the real-world parallel? 0% = title gives it away. 100% = allegory invisible without external context. | _Simulation-based threshold_         |
| **Character Interiority** | Narratological mode classification per paragraph: external action only → reported thought → free indirect discourse → direct interior monologue → stream of consciousness. Score = weighted centroid across the ordinal scale.                                                            | _Literary-theoretic classification_  |
| **Moral Resolution**      | Dialectical completeness taxonomy: thesis only (didactic) → thesis + antithesis with victor (agonal) → synthesis into third position (Hegelian) → sustained genuine ambiguity (aporia). Score = position on this four-point taxonomy.                                                     | _Philosophical dialectical analysis_ |
| **Temporal Architecture** | Function topology: classify the mapping from narrative order to story chronology. Linear (monotonic) → Circular (endpoint connects to beginning) → Fractal (self-similar at multiple scales) → Labyrinthine (irreconcilable branching). Score = topological class.                        | _Mathematical classification_        |

_Why hard:_ Every dimension interacts with every other in deep, non-obvious ways. High allegorical opacity requires specific temporal architectures. Low moral resolution amplifies opacity (no clear moral stance to decode the allegory). Character interiority can accidentally reveal the allegory through a character's inner knowledge. The rubrics require fundamentally different evaluator competencies — reader simulation, narratology, dialectical philosophy, topology — meaning the system likely needs specialized evaluator chains for each dimension.

_IK behavior:_ This is a 4-DOF end effector controlled by a very-high-DOF arm. The Jacobian is dense — every dimension couples to every other. There are multiple singularities: for instance, increasing Character Interiority past a threshold may force the arm through a singularity where the only way to maintain high Allegorical Opacity is to radically restructure the temporal architecture. The free energy landscape supplements the IK picture here: the prompt space has multiple basins (fundamentally different story architectures), and navigating between them requires barrier-crossing moves that the IK solver alone wouldn't suggest. The app should detect when the user is near a basin boundary and offer to show alternatives from other basins.

### 6.7 Very Hard: Therapeutic Conversation Guide

The dimensions here are relational and ethical — they describe properties of a text that will shape a human relationship. Rubrics require modeling emotional states, power dynamics, and ethical constraints simultaneously. This is the most demanding example because errors have real consequences for vulnerable people.

**Example 7: Motivational Interviewing Script**

**User input:** _Create a guide for a therapist conducting a motivational interviewing session with a client who is ambivalent about reducing alcohol use._

| Dimension                        | Rubric / Measurement                                                                                                                                                                                                                                                                                                                                                                                                              | Rubric Type                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Client Autonomy Preservation** | Scan every therapist utterance for the speech act it performs: reflecting, affirming, asking, informing, directing, warning, prescribing. Map each to an autonomy-support score (reflecting = high, prescribing = low). Aggregate using minimum-weighted-average: the score is pulled toward the most autonomy-violating moment, because a single directive statement can undo a session's worth of reflective work.              | _Speech act classification with min-weighted aggregation_ |
| **Ambivalence Elicitation**      | Track the balance of "change talk" vs. "sustain talk" that the script is designed to elicit from the client. For each therapist move, classify whether it is likely to evoke client change talk, sustain talk, or is neutral. Score = (change-talk-eliciting moves) / (total directional moves). But penalize any sequence of 3+ consecutive change-talk moves, as this creates therapeutic pressure that violates the MI spirit. | _Sequential classification with pattern penalty_          |
| **Empathic Accuracy**            | For each therapist reflection, rate whether it captures the emotional valence, the cognitive content, and the motivational function of the hypothetical client statement it follows. Full marks require all three; partial credit for valence-only or content-only reflections. Score = average accuracy across all reflections.                                                                                                  | _Multi-attribute accuracy per-utterance_                  |

_Why very hard:_ The rubrics require modeling a hypothetical client's psychological state — not just analyzing the text in isolation, but simulating a dyadic interaction. The dimensions encode ethical constraints (autonomy preservation) alongside clinical effectiveness (ambivalence elicitation), and these are in productive tension: the most effective way to elicit change talk is sometimes to push, which violates autonomy. Errors are not merely aesthetic — a prompt that scores well on elicitation but poorly on autonomy could produce a script that harms a real client.

_IK behavior:_ The workspace has hard boundaries that represent ethical walls, not just practical limits. Client Autonomy Preservation acts as a joint limit — a floor that must never be violated regardless of what the other sliders request. The Jacobian shows that Ambivalence Elicitation and Client Autonomy are strongly anti-correlated near the ethical boundary: the most effective elicitation moves are the ones that most threaten autonomy. The IK solver must treat the autonomy floor as a hard constraint, not a soft target — the system should refuse to generate a prompt that crosses the ethical boundary even if the user requests it. Manipulability near this boundary is low, and the app should surface confidence intervals aggressively: the evaluator's uncertainty about whether a given utterance violates autonomy has real consequences.

## 7. The Meta-Pattern Across Examples

The seven examples above reveal a consistent progression along several axes:

- **Rubric epistemology.** Easy examples use surface-readable rubrics (pattern matching, counting). Medium examples require structural analysis (graph theory, gradient smoothness). Hard examples require simulation of other minds (adversarial reviewers, naive readers, therapeutic clients). Very hard examples require simulation of a dynamic relationship between minds.

- **Dimension coupling (Jacobian density).** Easy examples have nearly diagonal Jacobians — dimensions are relatively independent. Medium examples have predictable off-diagonal terms. Hard examples have dense Jacobians where every dimension couples to every other, and the coupling is context-dependent — the optimal value of one dimension depends not just on the values of others but on the specific structural choices that implement them.

- **Workspace constraints.** Easy examples have large, open workspaces with ample room to maneuver. Medium examples have soft boundaries. Hard examples have narrow feasible corridors, hard ethical walls, and multiple distinct feasible regions (alternative IK solutions) separated by singularities.

- **Evaluator specialization.** Easy examples can be scored by a single general-purpose LLM-as-judge call. Hard examples require multiple specialized evaluator chains, each fluent in a different discipline (law, narrative theory, clinical psychology). The scoring architecture must support this heterogeneity.

- **Consequence weight.** Easy examples are low-stakes (a slightly suboptimal email). Hard examples involve financial risk (legal clauses) or human welfare (therapeutic scripts). The app must surface confidence intervals and evaluator uncertainty more aggressively as stakes increase.

The app's deepest value proposition is that it handles all seven cases with the _same interface_: a spider chart, some sliders, and a lock button. The complexity lives entirely in the hidden layers — the IK solver and the free energy landscape it navigates — and the user navigates all of it through the same sculpting gesture.

## 8. Key Challenges

The following challenges are ordered roughly by how early they will be encountered and how fundamentally they shape the architecture.

1. **Evaluator reliability and noise propagation.** The entire system depends on LLM-as-judge scoring. LLM evaluators are noisy: run the same evaluation twice and the score may differ. This noise propagates through the feedback loop. If the score is unreliable, dragging a slider becomes unpredictable — the end effector appears to jitter. The system must either reduce noise (multiple evaluations, calibrated rubrics, ensembles) or make noise visible (confidence intervals on the spider chart). Both approaches have costs: reduced noise increases latency and compute; visible noise increases UI complexity. The MVP must find a tenable balance.

2. **Dimension quality and the bad-collective-variable problem.** Not every dimension the user proposes will be a good one. A "bad dimension" is one that does not correspond to a coherent mode of variation in prompt space — moving the slider produces erratic, unpredictable changes (the arm flails). The system must detect bad dimensions (high scoring variance, non-monotonic response to slider changes — equivalently, a badly conditioned Jacobian column) and guide the user toward better ones, without being patronizing or opaque about why.

3. **Locking fidelity and constraint reconciliation.** When the user locks a dimension at value X and adjusts another, the system must regenerate a prompt that scores X on the locked dimension. But the IK solver may not be able to achieve X exactly while also hitting the target on the free dimension — the null space at the current configuration may not extend in the desired direction. How much tolerance is acceptable? What happens when locks conflict with each other or with fine-grained phrase locks? The system must either solve constrained IK reliably or communicate clearly when constraints cannot be simultaneously satisfied.

4. **Latency and the sculpting experience.** The sculpting metaphor requires a tight feedback loop. Each cycle involves: regenerating the prompt (an LLM call), scoring it on every dimension (multiple LLM-as-judge calls), and updating the UI. If this takes 15–20 seconds, the timescale separation breaks and the user loses flow. If it takes 3–5 seconds, the experience feels responsive. Achieving the lower end may require aggressive caching, incremental regeneration, or pre-computing nearby points on the workspace.

5. **Singularities and discontinuities.** The IK analogy predicts that smooth slider movement can cause discontinuous changes in prompt structure when the arm passes through a singularity. The user slides "formality" smoothly upward and suddenly the entire architecture flips. This is jarring if unexpected and powerful if surfaced. The system needs a mechanism to detect and telegraph singularities before they are reached, possibly by pre-sampling the workspace ahead of the slider's current position.

6. **Heterogeneous evaluator chains.** The hard examples require fundamentally different evaluation approaches for different dimensions within the same session. "Allegorical opacity" requires reader simulation. "Temporal architecture" requires structural analysis. These cannot share a single scoring prompt. The architecture must support pluggable, dimension-specific evaluator chains while maintaining consistent scoring semantics across dimensions.

7. **Rubric generation quality.** The system must generate rubrics that are both precise enough to evaluate reliably and meaningful enough that the user recognizes them as capturing what they care about. This is a hard meta-prompting problem: generating a good rubric for "allegorical opacity" is itself a task requiring literary-critical sophistication. Poor rubrics will make the entire tool feel arbitrary.

8. **The exploration–exploitation tension.** Should the system show the user the best prompt it can find for the current slider configuration (exploitation — the nearest IK solution), or should it sometimes show structurally diverse alternatives that score similarly but use a different joint configuration (exploration — an alternative IK solution from a different basin)? Exploitation is safer and more predictable. Exploration may reveal globally better prompt architectures. The system needs both modes, and the user needs to understand which they're in.

## 9. MVP: The Smallest Viable Version

The MVP must be small enough to build quickly, useful enough to validate the core hypothesis, and architecturally clean enough that every future feature extends naturally rather than requiring a rewrite. The governing principle is: **do one example perfectly, not seven examples roughly.**

### 9.1 Scope

The MVP supports a single use case: the cold outreach email (Example 1). This is chosen because the dimensions are intuitive, the rubrics are surface-readable, the workspace is large and open (no singularities, low coupling), the stakes are low, and iteration cycles are fast (short texts regenerate quickly).

### 9.2 Features

1. **Text input.** A single text field where the user describes what they want: "Write a cold email to a Series B investor about our AI infrastructure startup."

2. **Dimension proposal.** The system generates exactly 3 dimensions with rubrics and presents them to the user with a brief explanation of each. The user can accept the set or type a replacement dimension in natural language. No custom rubric editing in V1.

3. **Initial generation and scoring.** The system generates an initial prompt and scores it on all 3 dimensions. The scores appear on a simple spider chart.

4. **Lock/unlock.** Each dimension has a lock toggle. By default, all are unlocked after initial generation. The user locks 2 and explores the 3rd via a slider.

5. **Slider and regeneration.** The slider adjusts the target value for the unlocked dimension. A "Regenerate" button triggers a new prompt that attempts to hit the target while respecting locks. The spider chart updates.

6. **Version history.** Each regeneration is saved. The user can compare any two versions side by side and revert to any prior version.

7. **Export.** The user can copy the final prompt to clipboard.

### 9.3 What the MVP Deliberately Omits

The following are out of scope for MVP but the architecture must not preclude them: custom rubric editing, more than 3 dimensions, emergent dimension suggestion, fine-grained text locking, batch exploration (multiple variants), dimension coupling visualization, singularity detection, constraint definitions across dimensions, and specialized evaluator chains. Each of these is a natural extension of the MVP's architecture.

### 9.4 Validation Criteria

The MVP is successful if:

- Users can generate a prompt, understand the dimensions, and use the lock-and-slide workflow without explanation.

- Locking a dimension and moving another produces a regenerated prompt that "feels right" — the locked dimension remains stable and the free dimension moves in the expected direction.

- Users converge on a prompt they prefer to their manual attempts, in fewer iterations.

- The full cycle (slide → regenerate → score → display) completes in under 8 seconds.

## 10. Expansion Roadmap

Each phase builds on the previous. The architecture should make each transition a feature addition, not a rewrite.

### Phase 1: Foundation (MVP)

Cold email use case. 3 system-generated dimensions. Basic lock/slide/regenerate cycle. Version history. Single evaluator prompt per dimension. The IK solver operates in its simplest mode: near-diagonal Jacobian, large workspace, no singularities.

### Phase 2: User Expression

1. **Custom dimensions.** The user can define dimensions in natural language. The system generates rubrics and validates orthogonality against existing dimensions — checking the Jacobian for near-linear-dependence between columns.

2. **Custom rubric editing.** The user can inspect and modify the generated rubric for any dimension. The system re-evaluates scoring consistency after rubric changes.

3. **Up to 7 dimensions.** The spider chart scales. The system warns when dimension count approaches the arm's degrees of freedom — the point where the workspace becomes tightly constrained and manipulability drops everywhere.

4. **Dimension coupling display.** The system visualizes the Jacobian as pairwise correlations between dimensions and warns the user before they make a move that is likely to destabilize a locked dimension.

### Phase 3: Interaction Depth

1. **Fine-grained locking.** Lock a specific phrase, an intent, a structural feature, or a tonal register within a section of the prompt. These are additional joint-space constraints that reduce the null space available for slider movement.

2. **Batch exploration.** Instead of a single regeneration, the system produces 3–5 variants for the user to compare — alternative IK solutions that achieve similar end-effector positions through different joint configurations. The user can annotate and provide feedback on which features of each variant they prefer.

3. **Emergent dimension suggestion.** The system observes patterns in the user's edits and annotations and suggests new dimensions. The user can accept or dismiss these.

4. **Constraint definitions.** The user defines cross-dimension constraints: "motivational must never drop below 0.4." These are workspace boundaries that the IK solver treats as hard limits.

### Phase 4: Evaluation Sophistication

Specialized evaluator chains per dimension, enabling the hard examples (legal, literary, therapeutic). Multi-step evaluation for complex rubrics. Confidence intervals on the spider chart. Singularity detection and signaling — the system warns the user when they are approaching a configuration where smooth adjustment will break down. Adaptive slider sensitivity based on local manipulability. The system becomes capable of supporting any of the seven examples described in this document.

### Phase 5: Ecosystem

Saved dimension sets and rubrics, shareable as templates. Community library of rubrics for common use cases. Integration with downstream LLM workflows (the sculpted prompt feeds directly into a generation pipeline). Analytics on which dimensions and rubric types produce the highest user satisfaction. API access for programmatic prompt sculpting.

## 11. Design Principles

These principles should govern every design decision, from UI layout to scoring architecture.

1. **The complexity is hidden, never absent.** The system is deeply sophisticated internally. The user sees simplicity. This is the timescale separation: the grammar layer (the arm's joints) equilibrates at compute speed; the user (guiding the hand) moves at human speed. If the hidden layer's complexity ever leaks into the UI — confusing score changes, unpredictable regenerations, opaque error messages — the product has failed.

2. **The user's vocabulary is sacred.** If the user calls a dimension "punchiness," the system works with "punchiness." It may internally decompose this into rhetorical tempo, sentence length variance, and active-voice density, but the user never sees those internals. The mapping between user vocabulary and system mechanics is the grammar layer's job, not the user's.

3. **Every move is reversible.** Sculpting is a process of exploration. Dead ends are not failures; they are information. The system must make it cheap to try things and cheap to undo them. Version history, A/B comparison, and one-click revert are not features — they are structural requirements.

4. **Uncertainty is honest.** When the evaluator is unsure about a score, the system says so. When a locked dimension could not be perfectly maintained, the system shows the deviation. When dimensions conflict — when the Jacobian says "you can't move here without moving there" — the system names the conflict. Trust is built by transparency about limitations, not by false precision.

5. **The interface is the same at every difficulty level.** The user who sculpts a cold email (open workspace, diagonal Jacobian) and the user who sculpts a Borgesian allegory (narrow corridors, dense Jacobian, multiple singularities) use the same spider chart, the same sliders, and the same lock buttons. The system adapts its internal complexity to the task. The user does not need to know the task is hard.

6. **The sculpting metaphor is primary.** Every feature must answer: does this help the user feel like a sculptor revealing form from raw material? Features that break the metaphor — requiring the user to edit raw prompts, exposing the grammar layer, asking the user to configure evaluation parameters — should be resisted until the metaphor is fully established.

7. **The workspace is communicated, not just the position.** The user should always have a sense of where they can go, not just where they are. The app should show reachable ranges for each slider given the current locks, indicate when the user is near a workspace boundary, and signal when a singularity lies ahead. Navigation is only possible when you can see the road, not just your feet.

---

_— End of Document —_
