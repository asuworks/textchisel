# textchisel

A visual workbench for shaping AI-generated text. Tell it what you want to write, then drag a chart to control _how_ it's written.

> **Technical details?** See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture, and development guide.

## The Problem

When you ask an AI to write something, you get one version. If it's not right, you rewrite your prompt and try again. You're navigating a huge space of possible outputs by typing words into a box and hoping.

textchisel gives you a map of that space — and lets you steer.

## How It Works

### 1. Describe what you want

You type a writing intent in plain language:

> "Write a bedtime story for a 5-year-old about a penguin who wants to fly"

### 2. The system figures out what "good" means

An AI reads your intent and generates **evaluation dimensions** — the qualities that matter for this specific piece of writing. For the penguin story, it might create:

| Dimension           | What it measures                                    |
| ------------------- | --------------------------------------------------- |
| Imagination         | How creative and fantastical the story elements are |
| Emotional Warmth    | How comforting and tender the narrative feels       |
| Humor               | How funny and playful the writing is                |
| Age-Appropriateness | How well it matches a 5-year-old's comprehension    |
| Narrative Arc       | How complete the beginning-middle-end structure is  |

Each dimension comes with a **rubric** — a scale from 1 to 5 with written descriptions of what each level means. This isn't a vague "rate 1-5" — level 3 of Humor means something specific and different from level 3 of Emotional Warmth. For stylistic and qualitative dimensions, the system also generates **calibration examples** — short text samples that show what each rubric level looks like in practice.

You can also **specify your own dimensions** by adding `#` lines to your intent:

> Write a bedtime story for a 5-year-old about a penguin who wants to fly
> \# Emotional Warmth
> \# Number of deaths in the story
> 1: one death
> 2: 3-5 deaths
> 5: the universe collapsed

### 3. First draft, scored

The system writes a first draft and immediately scores it against every dimension. A spider chart (radar chart) displays the results — you can see at a glance where the text is strong and where it falls short.

### 4. Drag to reshape

Here's the key interaction: **you drag the chart points to set targets**.

Want more humor and less emotional warmth? Pull the Humor axis to 5 and Warmth down to 1. The chart now shows two overlapping shapes — where the text _is_ (current scores) and where you want it to _be_ (your targets).

### 5. The system rewrites to match

Hit "Refine" and the AI rewrites the text to hit your targets. It doesn't just retry randomly — it knows exactly which dimensions to push up and which to pull back, guided by the rubrics. The sentimental penguin story becomes a slapstick comedy where the penguin keeps crashing into things.

### 6. Keep going

Each rewrite is scored again. Drag again. Refine again. Every version is saved as an immutable snapshot — you can always go back. The loop continues until the text feels right.

## What makes this different from "just prompting"

- **You see the quality space.** Instead of guessing what to type, you see dimensions on a chart and drag toward what you want.
- **The rubrics are specific.** The AI generates precise, per-dimension scoring criteria — not generic "rate this 1-5."
- **It's a closed loop.** Score, adjust targets, rewrite, re-score. The system converges toward your intent rather than random-walking through prompt variations.
- **Every version is preserved.** You never lose a good draft while chasing a better one.

## Where this is useful

textchisel is most powerful when the same intent needs to produce different text depending on audience, channel, or tone:

- **Marketing** — Generate A/B copy variants by dragging urgency, trust, and brand voice to different positions
- **Legal** — Same clause rewritten for lawyers (high precision) vs. consumers (high readability)
- **Medical** — Turn clinical notes into patient instructions by adjusting literacy level and anxiety reduction
- **Education** — Explain a concept to a 10-year-old vs. a PhD student — same topic, different depth and vocabulary
- **HR / diplomacy** — Find the right blend of directness and warmth for difficult conversations
- **Documentation** — Same feature described as a quickstart, API reference, or tutorial
- **Support** — Match empathy and policy strictness to complaint severity

The common pattern: **any writing task where quality is multi-dimensional and audience-dependent**.

## Try it

> Write a bedtime story for a 5-year-old about a penguin who wants to fly

Enter this as your intent. Watch the dimensions appear. Drag the chart around. See how the same story transforms as you move through the space of possible versions.

## License

MIT
