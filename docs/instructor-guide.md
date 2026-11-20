# Guide for instructors and reviewers

## What the app is for

ModSim Essentials is a project compass. A student or a professional team uses it to define a modelling project and to carry that definition through the work as a **model passport**. It deliberately does not teach methods or build specialist models; those belong in lectures and in the method-specific apps.

## Using it in a course

| When | What students do | What you receive |
| --- | --- | --- |
| Weeks 1–2 | Steps 1–2: frame the question, set the scope | **Proposal** checkpoint export |
| Weeks 3–4 | Steps 3–4: choose a method, document inputs and assumptions | **Design** checkpoint export |
| Mid-semester | Step 5: verification and validation plan, with a working baseline in the specialist app | **Baseline** checkpoint export |
| Later | Step 6: outcomes and a fair experiment | **Evaluation** checkpoint export |
| End | Step 7: results, conditional recommendation, limitations | **Final** checkpoint export |

Ask for the ZIP export at each checkpoint. It contains:

- the passport as Markdown and standalone HTML;
- the re-importable project file (JSON);
- sandbox results as CSV, where used;
- a manifest with versions.

## Assessing a passport

- **Open items** list what is missing or risky at export time, from a fixed rule table. They are prompts, not marks. A passport with no open items can still rest on weak evidence.
- **Self-check answers** are the student's own words. The app never grades them; they are there for you to read.
- **Rubrics:** each checkpoint has three criteria with four levels (Not yet, Emerging, Developing, Strong). Students can self-assess, and you can record your own levels.
- **Review status** (Draft, Self-reviewed, Reviewer-reviewed, Needs revision) is a manual label with no authentication. If it carries grading weight, confirm it in conversation or from the exported file.
- **Completeness** ("N of 7 steps started") counts steps only. It is neither validity nor review status.

## The worked example

A complete passport for a student-support backlog study opens read-only from Home. Students can compare their own answers with it step by step, or copy it as a practice project. It is a model of form and reasoning, not a template to paste from.

## Mistakes the compass watches for

- The proposed solution written as the problem.
- A question with no measurable outcome.
- Nothing listed as excluded from the scope.
- A method chosen without an alternative or a reason.
- A waiting-time question paired with a method that cannot estimate individual waiting times.
- Inputs without units or sources.
- Assumptions without a planned check.
- Calibration presented without separate validation.
- A stochastic method with no replications or seed recorded.
- A recommendation with no conditions that would change it.

## Data and privacy

Everything stays in the user's browser. Nothing is uploaded, and work does not move between browsers or devices without exporting and importing a project file. Do not ask students to enter records about identifiable people.

## Specialist app links

Edit `SPECIALIST_APPS` in `src/domain/methods/registry.ts`. Use only verified URLs. Leave `url: null` where an app has no confirmed address; the app then says the link is not configured.
