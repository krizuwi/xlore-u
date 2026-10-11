# Assessment scoring key: draft for psychometrician review

Status: NOT APPROVED. NOT ACTIVE. Prepared 2026-10-11.

Every prompt and option below is copied from the existing active database bank, including existing typos. Wording has not been changed.

Numbers are engineering hypotheses (0–3), not validated points. Empty mappings mean no positive evidence for a career-interest tag; they do not mean low ability.

The eight tags are the existing catalog vocabulary, not an established eight-scale psychological instrument. Please review constructs, mappings, overlap and coverage before approving any implementation.

The proposal separates 10 possible interest items from 10 context-only items. This split also requires review. Self-reported strength and group-role items may need contextual treatment instead.

Context-only preferences must not be converted into a fabricated peso budget, commute time, learning-style diagnosis or career aptitude score.

## Coverage audit (technical, not validation)

| Tag | Informative items | Minimum | Maximum |
| --- | ---: | ---: | ---: |
| technology | 8 | 0 | 9 |
| analytical | 10 | 0 | 17 |
| science | 4 | 0 | 4 |
| health | 2 | 0 | 2 |
| business | 7 | 0 | 13 |
| creative | 9 | 0 | 22 |
| communication | 9 | 0 | 9 |
| social | 9 | 0 | 19 |

Normalization accounts for available point ranges, but cannot repair unequal construct coverage or establish reliability. Health has very little independent evidence in this proposal.

## Answer mappings

### 1. Among the choices, what is your usual approach when faced with a complex problem?

Role: proposed-interest-evidence.

Review note: Hands-on work is too broad to equate automatically with engineering or technology.

- break it down using logic, math, or structured algorithms → analytical: 2, technology: 1
- brainstorm creative, visual, or non-conventional ideas → creative: 3
- talk it out with people to understand the human elements involved → social: 2, communication: 1
- look for hands-on, practical solutions that can be applied immediately → No interest points

### 2. Among the choices, which subject area do you currently find most interesting or
enjoyable?

Role: proposed-interest-evidence.

Review note: Several choices combine multiple subject fields. They cannot distinguish those fields independently.

- mathematics, computer studies, or physical sciences → analytical: 1, technology: 1, science: 1
- fine arts, design, literature, or media → creative: 2, communication: 1
- social studies, psychology, languages, or history → social: 2, communication: 1
- applied technology, business/accounting, or practical labs → technology: 1, business: 1

### 3. Among the choices, which type of activity do you find most engaging and can work on for an extended period?

Role: proposed-interest-evidence.

Review note: Building, managing and operating tasks combine different constructs; low-confidence business mapping needs review.

- solving problems, analyzing information, or working with technology → analytical: 2, technology: 1
- writing, designing, creating, or producing media → creative: 2, communication: 1
- communicating with others, helping people, or organizing activities → social: 2, communication: 1
- building, managing, operating, or completing practical tasks → business: 1

### 4. Among the choices, which activity do you usually find most helpful when learning something new?

Role: context-only (learningActivity).

Review note: Keep as a preference/context answer, not career-interest points.

- reading explanations, examples, and structured information → No interest points
- sing diagrams, illustrations, demonstrations, or visual materials → No interest points
- discussing ideas with teachers or classmates → No interest points
- practicing the task through activities, experiments, or demonstrations → No interest points

### 5. Among the choices, which type of strength best describes you?

Role: proposed-interest-evidence.

Review note: Self-reported strengths are not aptitude test scores. Consider excluding this item from interest totals.

- analyzing information and solving problems → analytical: 3
- creating ideas and expressing them in original ways → creative: 3
- understanding people and communicating effectively → social: 2, communication: 1
- organizing tasks and getting things done efficiently → business: 1

### 6. Among the choices, which type of work environment interests you the most?

Role: proposed-interest-evidence.

Review note: Health and education share one choice. This item alone cannot distinguish nursing from teaching.

- technology, science, engineering, or research-oriented environments → technology: 1, analytical: 1, science: 1
- creative, media, design, or communication-oriented environments → creative: 2, communication: 1
- education, healthcare, community, or public-service environments → social: 2, health: 1
- business, management, finance, or entrepreneurial environments → business: 3

### 7. Among the choices, what is most important to you when thinking about your future career?

Role: proposed-interest-evidence.

Review note: Financial stability and leadership are not necessarily business interests; consider contextual treatment of choice D.

- creating or improving technology, systems, or solutions → technology: 2, analytical: 1
- expressing ideas through creativity, design, or communication → creative: 2, communication: 1
- helping people or contributing to the community → social: 3
- achieving financial stability, leadership, or business success → business: 2

### 8. Among the choices, which career area would you most likely consider pursuing after
completing your education?

Role: proposed-interest-evidence.

Review note: Broad choices merge distinct careers; recommendations must acknowledge this resolution limit.

- engineering, information technology, science, or data-related careers → technology: 1, analytical: 1, science: 1
- design, media, arts, communication, or other creative careers → creative: 2, communication: 1
- healthcare, education, social services, or community-related careers → social: 2, health: 1
- business, management, finance, entrepreneurship, or related careers → business: 3

### 9. How interested are you in working with numbers and data?

Role: proposed-interest-evidence.

Review note: Not enjoying numbers supplies no positive evidence for arts, business or any other career.

- very interested; I enjoy analyzing numbers, patterns, and data → analytical: 3
- moderately interested; I enjoy using data when solving practical problems → analytical: 2
- slightly interested; I use numbers and data only when needed → analytical: 1
- not interested; I prefer work with little or no numbers and data → No interest points

### 10. Among the choices, which role are you most comfortable taking when working on a group project?

Role: proposed-interest-evidence.

Review note: Group roles are preferences, not demonstrated abilities. Consider contextual treatment instead.

- analyzing information, solving technical problems, or developing the project's structure → analytical: 2, technology: 1
- developing ideas and contributing to the project's creative presentation → creative: 3
- communicating with members, encouraging participation, and helping resolve concerns → social: 2, communication: 1
- organizing tasks, assigning responsibilities, and monitoring deadlines → business: 2

### 11. Among the choices, which type of higher education setting do you prefer the most?

Role: context-only (educationSetting).

Review note: Keep as a preference/context answer, not career-interest points.

- a structured environment focused on science, technology, research, or specialized subjects → No interest points
- a creative environment that encourages arts, media, design, or performance → No interest points
- a collaborative environment with opportunities for discussion, communication, and different academic subjects → No interest points
- a practical environment focused on hands-on activities, technical skills, and real-world applications → No interest points

### 12. Among the choices, which type of assessment allows you to demonstrate your
abilities best?

Role: context-only (assessmentFormat).

Review note: Keep as a preference/context answer, not career-interest points.

- written tests, problem-solving activities, or analytical tasks → No interest points
- portfolios, creative projects, presentations, or performances → No interest points
- essays, oral presentations, discussions, or group activities → No interest points
- demonstrations, practical tasks, experiments, or real-world activities → No interest points

### 13. Among the choices, which type of class environment do you prefer the most?

Role: context-only (classEnvironment).

Review note: Keep as a preference/context answer, not career-interest points.

- a structured class where I can focus on lessons and individual tasks → No interest points
- a creative class where I can develop and express my own ideas → No interest points
- a collaborative class where I can interact and learn with others → No interest points
- a hands-on class where I can practice and apply what I learn → No interest points

### 14. Among the choices, how much flexibility would you prefer in your program?

Role: context-only (programFlexibility).

Review note: Keep as a preference/context answer, not career-interest points.

- a structured program with clear schedules, requirements, and learning activities → No interest points
- a flexible program that lets me develop my interests through creative or specialized activities → No interest points
- a program that offers different subjects and opportunities to explore various interests → No interest points
- a program that emphasizes practical skills and direct application of learning → No interest points

### 15. Among the choices, which type of extracurricular activity would interest you the most?

Role: proposed-interest-evidence.

Review note: Choice D mixes entrepreneurship, vocational skills and sports; no single career tag is defensible.

- science, technology, academic, or research-related activities → technology: 1, science: 1, analytical: 1
- arts, media, music, theater, design, or creative activities → creative: 3
- student organizations, community service, leadership, debate, or social activities → social: 2, communication: 1
- entrepreneurship, technical-vocational activities, sports, or skills-based organizations → No interest points

### 16. How important is tuition cost when choosing a school?

Role: context-only (tuitionImportance).

Review note: Keep as a preference/context answer, not career-interest points.

- not very important; other school features are more important to me → No interest points
- somewhat important; I prefer a reasonably priced school → No interest points
- very important; I prefer an affordable school or one that offers financial assistance → No interest points
- extremely important; the school must fit within my family's available budget → No interest points

### 17. How important is the school's distance from your home?

Role: context-only (distanceImportance).

Review note: Keep as a preference/context answer, not career-interest points.

- not important; I am willing to travel a long distance → No interest points
- slightly important; I am comfortable with some travel → No interest points
- very important; I prefer a school that is reasonably accessible from home → No interest points
- extremely important; I prefer or need a school that is close to home → No interest points

### 18. What is your preferred maximum one-way travel time to school?

Role: context-only (travelTimePreference).

Review note: Keep as a preference/context answer, not career-interest points.

- less than 30 minutes → No interest points
- 30–60 minutes → No interest points
- 1–1.5 hours → No interest points
- more than 1.5 hours → No interest points

### 19. Among the choices, which type of school resource is most important for your
academic success?

Role: context-only (resourcePreference).

Review note: Keep as a preference/context answer, not career-interest points.

- science, computer, technology, or laboratory facilities → No interest points
- arts, media, creative, or performance facilities → No interest points
- library, guidance, student-support, or collaborative learning facilities → No interest points
- technical-vocational, sports, or career-development facilities → No interest points

### 20. Among the choices, which type of financial assistance would you consider if available?

Role: context-only (financialAssistancePreference).

Review note: Keep as a preference/context answer, not career-interest points.

- scholarships based on academic or extracurricular performance → No interest points
- need-based financial assistance or tuition discounts → No interest points
- school-based grants or other forms of financial support → No interest points
- I would not need financial assistance → No interest points

## Approval checklist

- Confirm exact current wording matches the questionnaire version intended for use.
- Define each construct and approve, revise or reject every proposed option mapping.
- Decide whether Q5, Q7, Q10 and other ambiguous choices should be context-only.
- Review program-to-interest tags independently with academic/career advisers.
- Define school preference handling only where actual school metadata supports it.
- Pilot the scoring against expert-reviewed cases; examine reliability, recommendation agreement, subgroup behavior and user usefulness.
- Specify what to show for mixed, weak or insufficient evidence, and what evidence supports any accuracy claim.
- Record reviewer names, approval date, key version and approved interpretation. Review alone must not be called predictive validation.

The current admin editor requires a positive point in every option; that rule and explicit context handling must be revised after approval before this proposal can be activated.
