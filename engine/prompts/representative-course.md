# Representative Course — Workplace Safety Fundamentals

Design a complete, premium deep-scroll e-learning course page. This is a SINGLE continuous page with navigation, flowing sections, smooth transitions between content areas, and a completion block. Design every component type AND every variant listed below — they will be extracted as reusable patterns. Components with multiple variants appear multiple times with different `data-variant` attributes; each variant must be visually distinct.

IMPORTANT: Wrap every component in a container with a `data-component-type` attribute matching its type name (e.g., `data-component-type="hero"`, `data-component-type="accordion"`). This is required for pattern extraction.

---

## PAGE STRUCTURE

### Navigation
A slim fixed top navigation bar (48–56px height) with:
- Hamburger menu icon on the left (opens a slide-out section drawer)
- Course title centered
- Progress percentage on the right
Keep it minimal — no section links in the header, no notification/profile icons. The section drawer (slide-in panel from left) is built by the hydration script, not by Stitch.

---

### SECTION 1 — Welcome

<div data-component-type="hero">

**[HERO]**
Title: Workplace Safety Fundamentals
Subtitle: Your comprehensive guide to creating and maintaining a safe working environment. Learn to identify hazards, respond to emergencies, and build a culture of safety.
CTA Button: "Begin Course"
Background: Full-viewport with gradient overlay, background image of a modern workplace.

</div>

---

### SECTION 1b — Path Selection

<div data-component-type="path-selector">

**[PATH-SELECTOR]**
Title: Choose Your Learning Path
Body: Select your role to see content tailored to your responsibilities. You can change your selection at any time.
Instruction: Click your role below.
INTERACTIVE: Add `data-path-selector` on the container, `data-path-option` on each card, `data-path-variable="{variableName}"` on each card to identify which state variable it sets.

Options:
- Non-Technical (variable: Group1NonTechnical): Site logistics, car parking, valeting. You work around hazards but do not handle them directly.
- Semi-Technical (variable: Group2SemiTechnical): Service advisor, supervisor. You coordinate work and need awareness of all risk categories.
- Technical (variable: Group3Technical): Technician, mechanic. You work hands-on with hazardous systems and need the deepest knowledge.

Visual: Cards laid out in a grid (like branching component). Selected card gets a highlighted border/background. Unselected cards dim slightly.

</div>

---

### SECTION 2 — Introduction

<div data-component-type="text">

**[TEXT]**
Title: Why Safety Matters
Body:
Every year, thousands of workplace incidents could have been prevented with proper training and awareness. This course equips you with the knowledge and practical skills to identify hazards before they become incidents, respond effectively to emergencies, and contribute to a culture where safety is everyone's responsibility.

Whether you work in an office, warehouse, laboratory, or field environment, the principles covered here apply universally. By the end of this course, you will be confident in your ability to keep yourself and your colleagues safe.

</div>

<div data-component-type="stat-callout">

**[STAT-CALLOUT]**
Title: The Cost of Inaction
Stats:
- 2.3M — Workplace injuries reported annually
- 72% — Incidents preventable with proper training
- $170B — Annual cost to businesses worldwide
- 14% — Reduction in incidents after safety training

</div>

---

### SECTION 3 — Core Concepts

<div data-component-type="graphic-text">

**[GRAPHIC-TEXT]**
Title: Understanding the Hierarchy of Controls
Body:
The hierarchy of controls is the gold standard for managing workplace hazards. Rather than relying solely on personal protective equipment, effective safety programs eliminate hazards at the source whenever possible. This five-tier approach — elimination, substitution, engineering controls, administrative controls, and PPE — ensures the most effective protection for workers at every level.
Image: A modern infographic showing the hierarchy of controls pyramid.
Layout: Image on the right, text on the left.

</div>

<div data-component-type="accordion">

**[ACCORDION]**
Title: The Five Levels of Hazard Control
Instruction: Select each level to learn more about how it protects workers.
INTERACTIVE: Use native `<details><summary>` elements.

Items:
- Elimination: The most effective control. Remove the hazard entirely from the workplace. For example, replacing a dangerous chemical process with a mechanical one, or redesigning a workflow to eliminate a fall risk. If the hazard doesn't exist, no one can be harmed.
- Substitution: Replace the hazard with something less dangerous. Use water-based paints instead of solvent-based ones, or switch to lower-voltage equipment. This is the second most effective approach because it addresses the root cause.
- Engineering Controls: Isolate workers from the hazard through physical means. Install ventilation systems, machine guards, soundproof enclosures, or automated safety interlocks. These controls work independently of human behaviour.
- Administrative Controls: Change the way people work through policies, training, signage, and scheduling. Rotate workers to limit exposure time, create standard operating procedures, and implement permit-to-work systems.
- Personal Protective Equipment (PPE): The last line of defence. Provide safety glasses, gloves, hard hats, respirators, and hearing protection. PPE should supplement other controls, never replace them.

</div>

---

### SECTION 4 — Hazard Identification

<div data-component-type="tabs">

**[TABS]**
Title: Types of Workplace Hazards
INTERACTIVE: Add `data-tabs` on the container, `data-tab-trigger` on each tab button, `data-tab-panel` on each content panel.

Tabs:
- Physical Hazards: Physical hazards are the most visible type of workplace danger. They include slippery floors, exposed wiring, unguarded machinery, excessive noise, extreme temperatures, and poor lighting. Regular workplace inspections are the primary defence against physical hazards. Use a structured checklist to evaluate each area systematically — check flooring conditions, electrical equipment, machine guarding, noise levels, and emergency exit accessibility.
- Chemical Hazards: Chemical hazards arise from exposure to harmful substances through inhalation, skin contact, or ingestion. Common examples include cleaning solvents, laboratory reagents, paint fumes, and dust particles. Every chemical in your workplace must have a Safety Data Sheet (SDS) that details its hazards, safe handling procedures, and emergency measures. Always read the SDS before working with an unfamiliar substance.
- Biological Hazards: Biological hazards include bacteria, viruses, fungi, and other living organisms that can cause disease. Healthcare workers, laboratory staff, and those working with animals are most at risk. Standard precautions — hand hygiene, use of PPE, proper waste disposal, and vaccination programs — form the foundation of biological hazard management.
- Ergonomic Hazards: Ergonomic hazards result from repetitive movements, awkward postures, excessive force, and poorly designed workstations. They lead to musculoskeletal disorders affecting the back, neck, shoulders, and wrists. Proper workstation setup, regular breaks, task rotation, and ergonomic equipment can significantly reduce these risks.

</div>

<div data-component-type="bento">

**[BENTO]**
Title: Recognising Hazards in Your Environment
Body: Use these practical techniques during your daily routine to spot potential dangers.

Cards:
- Walk the Floor: Conduct a visual sweep of your workspace at the start of each shift. Look for spills, obstructions, damaged equipment, and missing safety signs. Report anything unusual immediately.
- Listen for Warnings: Unusual sounds from machinery — grinding, rattling, or hissing — often indicate mechanical problems that could become safety hazards. Trust your instincts when something sounds wrong.
- Check Your Equipment: Before using any tool or machine, perform a quick pre-use inspection. Verify guards are in place, emergency stops function, and cords or hoses are undamaged.
- Review Near Misses: Near-miss incidents are free safety lessons. Every near miss reveals a hazard that could cause serious harm next time. Report them, investigate them, and fix the root cause.
- Follow the Signs: Safety signs and labels are placed for good reason. Familiarise yourself with the meaning of each colour and shape — red for prohibition, yellow for warning, blue for mandatory action, green for safe condition.

</div>

---

### SECTION 5 — Emergency Procedures

<div data-component-type="full-bleed">

**[FULL-BLEED]**
Title: When Seconds Count
Body: In an emergency, your response in the first 60 seconds can determine the outcome. Preparation and practice turn panic into purposeful action. The procedures in this section could save a life — including your own.
Background: Edge-to-edge image with dramatic text overlay.

</div>

<div data-component-type="timeline">

**[TIMELINE]**
Title: Emergency Response Sequence
Body: Follow these steps in order when an emergency occurs.

Steps:
- Alert: Sound the alarm or call emergency services immediately. Do not assume someone else has already done so. Provide your exact location, the nature of the emergency, and the number of people affected.
- Assess: Quickly evaluate the situation from a safe distance. Identify the type of hazard (fire, chemical spill, structural, medical), the number of people involved, and whether the area is safe to enter. Never put yourself at risk.
- Act: If trained and safe to do so, take immediate action — administer first aid, use a fire extinguisher, shut off equipment, or begin evacuation. Follow your site-specific emergency procedures.
- Evacuate: Guide people to the nearest safe exit using designated evacuation routes. Assist anyone with mobility limitations. Move to the assembly point and do not re-enter the building.
- Account: At the assembly point, team leaders must verify that all personnel are accounted for. Report any missing persons to emergency services immediately.
- Report: Once the immediate emergency is resolved, file a detailed incident report. Include what happened, when, where, who was involved, and what actions were taken.

</div>

<div data-component-type="process-flow">

**[PROCESS-FLOW]**
Title: Fire Response Decision Tree
Body: Use this flow to determine the correct response when you discover a fire.

Nodes:
- Discover Fire: You notice flames, smoke, or the smell of burning. Do not ignore any sign, no matter how small.
- Sound Alarm: Activate the nearest fire alarm pull station. This alerts all building occupants to evacuate.
- Assess Size: Can you see the base of the fire? Is it smaller than a waste bin? Is the room free of thick smoke?
- Small & Contained?: If YES — and you are trained — attempt to extinguish using the correct fire extinguisher type. If NO — evacuate immediately.
- Evacuate: Close doors behind you to slow fire spread. Use stairs, never lifts. Proceed to the assembly point.

</div>

---

### SECTION 6 — Knowledge Check 1

<div data-component-type="mcq">

**[MCQ]**
Title: Knowledge Check
Question: According to the hierarchy of controls, what is the MOST effective way to manage a workplace hazard?
Instruction: Choose the best answer.
INTERACTIVE: Add `data-quiz` on the container, `data-correct="0"` (zero-indexed correct answer), and `data-choice` on each option button.

Choices:
- Eliminate the hazard entirely [CORRECT]
- Provide personal protective equipment
- Implement administrative procedures
- Install engineering controls

Correct feedback: That's right! Elimination removes the hazard completely, making it the most effective control measure.
Incorrect feedback: Not quite. While that approach has value, elimination is the most effective control because it removes the hazard entirely. Review the Hierarchy of Controls section.

</div>

---

### SECTION 7 — Key Terminology

<div data-component-type="key-term">

**[KEY-TERM]**
Title: Essential Safety Vocabulary
Terms:
- Hazard: Any source of potential damage, harm, or adverse effect on a person, property, or the environment. Hazards can be physical, chemical, biological, or ergonomic.
- Risk: The likelihood that a hazard will cause harm, combined with the severity of that harm. Risk = Probability x Consequence.
- Near Miss: An unplanned event that did not result in injury or damage but had the potential to do so. Near misses are critical learning opportunities.
- PPE: Personal Protective Equipment — wearable items designed to protect the user from specific hazards. Includes hard hats, safety glasses, gloves, and respirators.
- SDS: Safety Data Sheet — a standardised document containing information about a chemical's hazards, safe handling, storage, and emergency procedures.
- Incident: Any unplanned event that results in injury, illness, damage, or a near miss. All incidents must be reported and investigated.

</div>

<div data-component-type="flashcard">

**[FLASHCARD]**
Title: Test Your Knowledge
Instruction: Click each card to reveal the answer.
INTERACTIVE: Add `data-flashcard` on each card container (click to flip).

Cards:
- Front: What does ALARP stand for? → Back: As Low As Reasonably Practicable — the principle that risk should be reduced to the lowest level that is reasonably achievable, considering cost, time, and difficulty.
- Front: What are the three sides of the fire triangle? → Back: Heat, Fuel, and Oxygen. Remove any one of these three elements and the fire cannot sustain itself.
- Front: What colour is a mandatory safety sign? → Back: Blue with a white symbol. Mandatory signs indicate actions that MUST be taken, such as "Wear Eye Protection" or "Hard Hat Area."
- Front: What is the first action in DRSABCD? → Back: Danger — check for danger to yourself, bystanders, and the casualty before approaching. Your safety comes first in any emergency response.
- Front: What is a risk assessment? → Back: A systematic process of identifying hazards, evaluating the associated risks, and determining appropriate control measures to reduce those risks to an acceptable level.
- Front: When should PPE be used? → Back: As the LAST line of defence, after all other control measures in the hierarchy have been considered. PPE should supplement, not replace, other controls.

</div>

---

### SECTION 8 — Practical Application

<div data-component-type="narrative">

**[NARRATIVE]**
Title: Case Study — The Warehouse Incident
Body: Step through this real-world scenario to understand how multiple failures led to a preventable injury.
INTERACTIVE: Add `data-carousel` on the container, `data-slide` on each slide, `data-prev` and `data-next` on navigation buttons.

Slides:
- The Setting: A busy distribution warehouse handling 500+ shipments per day. The facility had passed its last safety audit with minor findings. Staff had completed mandatory safety training within the past 12 months.
- The Incident: During a peak period, a forklift operator took a shortcut through a pedestrian zone to save time. A warehouse worker stepped out from behind a racking unit and was struck by the forklift, sustaining a broken leg and concussion.
- Root Cause Analysis: Investigation revealed multiple contributing factors: faded floor markings, pressure to meet delivery targets, a broken convex mirror at the intersection, and no physical barriers between vehicle and pedestrian routes.
- Lessons Learned: The incident was entirely preventable. Physical barriers were installed, floor markings were refreshed with high-visibility paint, convex mirrors were added at all blind corners, and the culture of "speed over safety" was addressed through management training.
- Your Takeaway: Every shortcut carries hidden risk. Physical controls (barriers, mirrors) are more reliable than rules alone. And a safety culture starts with leadership — when managers prioritise speed over safety, workers follow their lead.

</div>

<div data-component-type="comparison">

**[COMPARISON]**
Title: Before vs After — Warehouse Safety Improvements
Columns: Before Incident | After Incident

Rows:
- Floor Markings: Faded, inconsistent | High-visibility, regularly maintained
- Vehicle/Pedestrian Separation: Painted lines only | Physical barriers installed
- Blind Corners: No mirrors | Convex mirrors at all intersections
- Speed Monitoring: No enforcement | Speed limiters fitted to all forklifts
- Safety Culture: Production-first messaging | Safety-first leadership training
- Near Miss Reporting: Informal, inconsistent | Mandatory digital reporting system

</div>

---

### SECTION 9 — Ergonomics & Wellbeing

<div data-component-type="graphic">

**[GRAPHIC]**
Full-width image: A clean, modern illustration of an ergonomic workstation setup showing correct monitor height, chair position, keyboard placement, and foot support.
Alt text: Diagram of an ergonomic workstation setup.

</div>

<div data-component-type="checklist">

**[CHECKLIST]**
Title: Ergonomic Workstation Checklist
Instruction: Check each item as you adjust your workspace.
INTERACTIVE: Add `data-checklist` on the container, use native `<input type="checkbox">` per item.

Items:
- Monitor at arm's length, top of screen at or slightly below eye level
- Chair height adjusted so feet are flat on the floor or on a footrest
- Keyboard and mouse at elbow height, wrists in a neutral position
- Back supported by the chair's lumbar support — no slouching
- Document holder positioned between monitor and keyboard if needed
- Regular breaks scheduled — stand, stretch, and refocus every 30 minutes
- Adequate lighting with no glare on screens
- Phone within easy reach without twisting or stretching

</div>

---

### SECTION 10 — Data & Reporting

<div data-component-type="data-table">

**[DATA-TABLE]**
Title: Incident Classification Matrix
Table:
| Severity Level | Description | Response Time | Reporting |
|---|---|---|---|
| Level 1 — Critical | Fatality or life-threatening injury | Immediate | Notify regulator within 1 hour |
| Level 2 — Major | Serious injury requiring hospitalisation | Within 1 hour | Report within 24 hours |
| Level 3 — Moderate | Injury requiring medical treatment | Within 4 hours | Report within 48 hours |
| Level 4 — Minor | First aid injury only | Within 24 hours | Report within 7 days |
| Level 5 — Near Miss | No injury, but potential existed | Within 48 hours | Report within 7 days |

</div>

<div data-component-type="pullquote">

**[PULLQUOTE]**
Quote: Safety is not an intellectual exercise to keep us in work. It is a matter of life and death. It is the sum of our contributions to safety management that determines whether the people we work with live or die.
Attribution: Sir Brian Appleton
Role: Safety and Reliability Directorate

</div>

---

### SECTION 11 — Interactive Learning

<div data-component-type="textinput">

**[TEXTINPUT]**
Title: Personal Safety Commitment
Body: Reflect on what you've learned. Write your personal commitment to workplace safety.
INTERACTIVE: Use native `<form>` with `<input>` elements.

Fields:
- One hazard I will look for tomorrow (placeholder: "e.g., Trailing cables near my desk")
- One safety habit I will adopt this week (placeholder: "e.g., Pre-use equipment checks")
- How I will support my team's safety (placeholder: "e.g., Report near misses promptly")

</div>

<div data-component-type="branching">

**[BRANCHING]**
Title: What Would You Do?
Body: A colleague tells you they've noticed a chemical spill in the storage room but haven't reported it because "it's probably nothing." Choose your response.

Options:
- Report it immediately to your supervisor and help secure the area
- Investigate the spill yourself to determine if it's serious
- Agree with your colleague that it's probably fine
- Ask another colleague for their opinion first

</div>

---

### SECTION 12 — Media & Visual Resources

<div data-component-type="media">

**[MEDIA]**
Title: Emergency Evacuation Drill Walkthrough
Body: Watch this 3-minute overview of a model evacuation procedure, then answer the reflection question below.
Video placeholder with play button and poster image.

</div>

<div data-component-type="video-transcript">

**[VIDEO-TRANSCRIPT]**
Title: Fire Extinguisher Training — PASS Technique
Body: Learn the four-step PASS technique for using a fire extinguisher safely and effectively.
Video placeholder with expandable transcript below.
Transcript: Pull the pin at the top of the extinguisher. This releases the locking mechanism. Aim the nozzle at the base of the fire, not at the flames. Standing six to eight feet away, squeeze the handle to release the extinguishing agent. Sweep the nozzle from side to side at the base of the fire until it is extinguished or the extinguisher is empty.

</div>

<div data-component-type="labeled-image">

**[LABELED-IMAGE]**
Title: Fire Extinguisher Anatomy
Image: A clear photograph of a fire extinguisher with labeled components.
Markers:
- x: 50, y: 5, label: Carrying Handle, body: The top handle used to carry and grip the extinguisher during use.
- x: 50, y: 15, label: Safety Pin, body: Pull this pin to unlock the extinguisher before use. It prevents accidental discharge.
- x: 30, y: 30, label: Pressure Gauge, body: Shows whether the extinguisher is charged and ready. The needle should be in the green zone.
- x: 50, y: 50, label: Cylinder Body, body: Contains the extinguishing agent. Different agents are used for different fire classes.
- x: 65, y: 25, label: Discharge Nozzle, body: Aim this at the base of the fire. Sweep from side to side for maximum coverage.

</div>

<div data-component-type="image-gallery">

**[IMAGE-GALLERY]**
Title: Safety Equipment Gallery
Images:
- Hard Hat: A white hard hat with chin strap, used in construction and industrial settings to protect against falling objects and head impacts.
- Safety Goggles: Splash-proof chemical safety goggles with indirect ventilation, providing full eye protection in laboratory environments.
- High-Vis Vest: A fluorescent yellow high-visibility vest with reflective strips, mandatory in all vehicle movement areas.
- Ear Defenders: Over-ear hearing protection rated for 30dB noise reduction, required in areas exceeding 85dB.

</div>

---

### SECTION 13 — Final Assessment

<div data-component-type="mcq">

**[MCQ]**
Title: Final Assessment
Question: You discover a small chemical spill in a corridor. The substance is unknown. What should you do FIRST?
Instruction: Choose the best answer.
INTERACTIVE: Add `data-quiz` on the container, `data-correct="1"` (zero-indexed correct answer), and `data-choice` on each option button.

Choices:
- Clean it up immediately using paper towels
- Secure the area and report it to your supervisor [CORRECT]
- Identify the chemical by smelling it carefully
- Continue walking — someone else will handle it

Correct feedback: Correct! With an unknown substance, your first action is to secure the area to prevent others from exposure, then report to a supervisor who can initiate the proper hazmat response.
Incorrect feedback: That's not the safest approach. With an unknown chemical, you should never attempt to clean it up or identify it yourself. Secure the area and report it immediately.

</div>

---

### SECTION 14 — Course Completion

<div data-component-type="text">

**[TEXT]**
Title: Congratulations
Body: You have completed Workplace Safety Fundamentals. Remember — safety is not a one-time training exercise, it is a daily practice. Apply what you've learned, stay vigilant, and never hesitate to speak up when you see a hazard. Your actions could prevent the next workplace injury.

</div>

---

### SECTION 15 — New Components & Variants

The following components and variants are NEW. Design each one with the same quality as the components above. Every variant must be visually distinct — if two variants look the same, the variant system adds no value.

---

#### DIVIDER VARIANTS

<div data-component-type="divider" data-variant="line">

**[DIVIDER — variant: line]**
A subtle horizontal rule centered in the page with reduced opacity. Provides clean visual separation between sections. No text, no icons — just a thin line with generous vertical margin above and below.

</div>

<div data-component-type="divider" data-variant="spacing">

**[DIVIDER — variant: spacing]**
Pure whitespace — no visible element. Extra vertical padding (approx 4rem) that creates cognitive breathing room between dense sections. Invisible but intentional.

</div>

<div data-component-type="divider" data-variant="icon">

**[DIVIDER — variant: icon]**
A centered Material Symbols icon (e.g., `lightbulb`) flanked by thin horizontal lines extending to the edges. The icon should be subtle (muted colour, small size ~20px). Signals a topic shift with personality.
Icon: <span class="material-symbols-outlined">lightbulb</span>

</div>

---

#### CALLOUT VARIANTS

<div data-component-type="callout" data-variant="info">

**[CALLOUT — variant: info]**
Title: Did You Know?
Body: Workplace safety regulations are updated annually. Staying current with the latest standards ensures your procedures reflect best practices and legal requirements. Check your regulatory body's website quarterly for updates.
Style: Subtle background card with left border accent in the brand's info colour (blue/neutral). An info icon (e.g., `info` from Material Symbols) in the top-left. Rounded corners, gentle shadow.

</div>

<div data-component-type="callout" data-variant="warning">

**[CALLOUT — variant: warning]**
Title: Common Mistake
Body: Never assume a chemical is safe because it has no strong odour. Many hazardous substances — including carbon monoxide — are completely odourless. Always check the Safety Data Sheet before handling any unfamiliar substance.
Style: Amber/orange left border accent with warning icon (`warning` from Material Symbols). Warm-toned background that signals caution without alarm.

</div>

<div data-component-type="callout" data-variant="tip">

**[CALLOUT — variant: tip]**
Title: Pro Tip
Body: Set a recurring 30-minute reminder on your phone to stand and stretch. This simple habit reduces musculoskeletal strain by 40% compared to sitting for extended periods without breaks.
Style: Green left border accent with lightbulb icon (`tips_and_updates` from Material Symbols). Fresh, positive background tone.

</div>

<div data-component-type="callout" data-variant="success">

**[CALLOUT — variant: success]**
Title: Great Progress
Body: You've now mastered the hierarchy of controls — the foundation of all workplace safety. This framework applies to every hazard you'll encounter, from chemical spills to ergonomic risks.
Style: Green/positive left border accent with check circle icon (`check_circle` from Material Symbols). Celebratory, encouraging tone.

</div>

---

#### TEXT VARIANTS

<div data-component-type="text" data-variant="standard">

**[TEXT — variant: standard]**
Title: Understanding Risk Assessment
Body:
Risk assessment is the systematic process of identifying hazards, evaluating their likelihood and severity, and determining appropriate control measures. Every workplace must conduct regular risk assessments to comply with health and safety legislation and to protect workers from harm.

A thorough risk assessment considers not just the obvious physical hazards but also chemical exposures, biological risks, ergonomic factors, and psychosocial stressors. The goal is not to eliminate all risk — that would be impossible — but to reduce it to a level that is as low as reasonably practicable (ALARP).

Visual: Single-column prose with heading above. No card, no background, no border — just clean typography on the page background. This is the DEFAULT text layout. The heading should be visually distinct (larger, bolder) from the body text.

</div>

<div data-component-type="text" data-variant="two-column">

**[TEXT — variant: two-column]**
Title: Proactive vs Reactive Safety
Body:
Split this content into two columns side by side:

Column 1 — Proactive Safety:
Proactive safety focuses on preventing incidents before they occur. It includes regular risk assessments, safety audits, near-miss reporting, and continuous improvement of procedures. Organisations with strong proactive cultures see 60% fewer incidents than those that rely primarily on reactive measures.

Column 2 — Reactive Safety:
Reactive safety responds after an incident has occurred. It includes incident investigation, corrective actions, and regulatory reporting. While essential, reactive-only approaches mean someone has already been harmed. The most effective safety programs combine both approaches with a strong emphasis on prevention.

Visual: Two distinct columns with a subtle vertical divider or spacing between them. Same typography, same background — the layout IS the design.

</div>

<div data-component-type="text" data-variant="highlight-box">

**[TEXT — variant: highlight-box]**
Title: Key Takeaway
Body:
The single most important principle in workplace safety is this: every hazard you identify and control today is an incident that won't happen tomorrow. Safety is not about paperwork, compliance, or box-ticking — it's about ensuring every person goes home at the end of the day.

Visual: Subtle background card (slightly elevated from page background) with a left accent border in the brand's primary colour. Stands out from regular text blocks without being as prominent as a callout. Think "elevated paragraph."

</div>

---

#### NARRATIVE VARIANTS

<div data-component-type="narrative" data-variant="image-focused">

**[NARRATIVE — variant: image-focused]**
Title: Safety Equipment Through the Ages
INTERACTIVE: Add `data-carousel` on the container, `data-slide` on each slide, `data-prev` and `data-next` on navigation buttons.

Slides:
- 1900s — Basic Protection: Early industrial safety was minimal. Workers wore cloth caps and leather aprons as their only protection. The concept of employer responsibility for safety barely existed. (Image: vintage factory scene)
- 1950s — Standards Emerge: Post-war industrialisation brought the first safety standards. Hard hats became mandatory in construction, and safety glasses were introduced for machine operators. (Image: 1950s construction site with hard hats)
- 2000s — Modern PPE: Today's safety equipment uses advanced materials — polycarbonate visors, Kevlar gloves, and active noise-cancelling ear protection. Smart PPE with embedded sensors is emerging. (Image: modern worker in full PPE)

Visual: Large image area (60%+ of slide). Image dominates, text is a secondary overlay or sidebar. Navigation arrows prominent. Dot indicators below. The image IS the story — text provides context.

</div>

<div data-component-type="narrative" data-variant="text-focused">

**[NARRATIVE — variant: text-focused]**
Title: The Bhopal Disaster — Lessons in Industrial Safety
INTERACTIVE: Add `data-carousel` on the container, `data-slide` on each slide, `data-prev` and `data-next` on navigation buttons.

Slides:
- The Night of December 2, 1984: At a Union Carbide pesticide plant in Bhopal, India, water entered a tank containing 42 tonnes of methyl isocyanate (MIC). The resulting exothermic reaction released a toxic gas cloud over the sleeping city. It remains the world's worst industrial disaster.
- What Went Wrong: Multiple safety systems had been disabled to cut costs: the refrigeration unit for the MIC tank was shut off, the gas scrubber was undersized, the flare tower was under maintenance, and the water curtain couldn't reach the height of the gas release.
- The Human Cost: Estimates of the death toll range from 3,800 (official) to over 16,000 (advocacy groups). Over 500,000 people were exposed. Survivors still suffer from chronic respiratory conditions, blindness, and birth defects four decades later.
- The Lesson: Every safety system that was disabled at Bhopal had been installed for a reason. Cost-cutting on safety doesn't save money — it borrows from the future. The Bhopal disaster led to sweeping reforms in industrial safety regulation worldwide.

Visual: Larger text area with prominent typography. Optional small image or icon per slide, but text carries the story. Clean, readable slides optimised for narrative flow. Think "digital magazine article."

</div>

---

#### FLASHCARD VARIANTS

<div data-component-type="flashcard" data-variant="grid">

**[FLASHCARD — variant: grid]**
Title: Quick-Fire Safety Review
Instruction: Click each card to test yourself.
INTERACTIVE: Add `data-flashcard` on each card container (click to flip).

Cards:
- Front: What is the PASS technique? → Back: Pull, Aim, Squeeze, Sweep — the four steps for using a fire extinguisher.
- Front: What does COSHH stand for? → Back: Control of Substances Hazardous to Health — UK regulations for managing chemical risks.
- Front: What is the minimum safe distance from a chemical spill? → Back: At least 25 metres upwind, unless trained hazmat responders determine otherwise.
- Front: How often should fire extinguishers be inspected? → Back: Monthly visual checks, annual professional servicing, and hydrostatic testing every 5-12 years depending on type.

Visual: Cards displayed in a responsive grid (2 columns on desktop, 1 on mobile). All cards visible at once. Each card has a front face and back face with 3D flip animation on click. Cards should be compact — optimised for short Q&A pairs.

</div>

<div data-component-type="flashcard" data-variant="single-large">

**[FLASHCARD — variant: single-large]**
Title: Scenario Cards
Instruction: Read each scenario, think about your answer, then click to reveal.
INTERACTIVE: Add `data-flashcard` on the card container (click to flip). Add `data-prev` and `data-next` navigation buttons.

Cards:
- Front: You arrive at work and notice the emergency exit is blocked by delivery boxes. What should you do? → Back: Immediately report the blocked exit to your supervisor. Do not attempt to move heavy boxes alone. If necessary, rope off the exit with warning tape until it can be cleared. Blocked emergency exits are a critical safety violation.
- Front: A colleague refuses to wear safety goggles because "they fog up." How would you respond? → Back: Acknowledge their discomfort — it's a valid concern. Suggest anti-fog goggles or spray. Explain that a moment of discomfort prevents permanent eye injury. If they still refuse, report it to your supervisor — PPE compliance is non-negotiable.
- Front: You hear an unfamiliar hissing sound from a pipe in the plant room. What are your first three actions? → Back: 1. Do not touch or approach the pipe. 2. Move yourself and others away from the area. 3. Report it immediately — a hissing pipe could indicate a gas leak, steam leak, or pressure vessel failure, all of which can be life-threatening.

Visual: One large card at a time, centred on the page. Prominent flip animation. Prev/next navigation buttons below the card with a counter (e.g., "2 of 3"). More space for longer text on each face.

</div>

---

#### CHECKLIST VARIANTS

<div data-component-type="checklist" data-variant="standard">

**[CHECKLIST — variant: standard]**
Title: Weekly Safety Inspection
Instruction: Complete each item during your walk-around.
INTERACTIVE: Add `data-checklist` on the container, use native `<input type="checkbox">` per item.

Items:
- Fire exits clear and unobstructed
- First aid kits fully stocked and in-date
- Emergency lighting functional
- Safety signage visible and undamaged
- Spill kits available and complete
- Electrical equipment PAT tested and in-date

Visual: Simple checkbox list with a progress indicator (e.g., "3/6 complete"). Clean, functional. Progress bar at the top or bottom fills as items are checked.

</div>

<div data-component-type="checklist" data-variant="card-style">

**[CHECKLIST — variant: card-style]**
Title: Your Safety Action Plan
Instruction: Commit to each action by checking the box.
INTERACTIVE: Add `data-checklist` on the container, use native `<input type="checkbox">` per item.

Items:
- Review my department's risk assessment this week (detail: Ask your line manager for the latest version and note any hazards relevant to your daily tasks)
- Complete the online fire warden refresher course (detail: Available on the learning portal — takes approximately 20 minutes)
- Conduct a personal workstation ergonomic check (detail: Use the checklist from Section 9 of this course)
- Report one near-miss or hazard observation (detail: Use the digital reporting form on the safety intranet page)

Visual: Each item is a distinct card with checkbox, title text, and expandable detail text. Cards have subtle background, rounded corners, and a hover/check state change. More visual weight per item than the standard list. Progress indicator above.

</div>

<div data-component-type="checklist" data-variant="numbered">

**[CHECKLIST — variant: numbered]**
Title: Chemical Spill Response — Step by Step
Instruction: Follow these steps in order.
INTERACTIVE: Add `data-checklist` on the container, use native `<input type="checkbox">` per item.

Items:
- Evacuate the immediate area (10-metre radius minimum)
- Alert others — shout a warning and activate the nearest alarm
- Identify the substance using container labels or SDS
- Don appropriate PPE (chemical-resistant gloves, goggles, apron)
- Contain the spill using absorbent materials from the spill kit
- Notify your supervisor and complete the incident report

Visual: Numbered badges (1, 2, 3...) instead of checkboxes. Items must be completed in sequence — checking item 3 before item 2 should be visually discouraged (greyed out or locked). Progress shown as step counter.

</div>

---

#### KEY-TERM VARIANTS

<div data-component-type="key-term" data-variant="list">

**[KEY-TERM — variant: list]**
Title: Risk Management Terminology
Terms:
- Residual Risk: The level of risk remaining after control measures have been implemented. No control measure eliminates risk entirely — residual risk must be monitored.
- Tolerable Risk: A risk level that has been reduced to a point where it is accepted by the organisation, considering the cost and practicality of further reduction (ALARP).
- Dynamic Risk Assessment: A continuous, real-time assessment of risk carried out during an activity. Used when conditions change rapidly, such as emergency response or outdoor work.

Visual: Vertical list. Each term is bold/highlighted, followed by its definition on the next line or indented. A subtle icon or accent mark next to each term. Clean, scannable format.

</div>

<div data-component-type="key-term" data-variant="card-grid">

**[KEY-TERM — variant: card-grid]**
Title: Types of Fire Extinguisher
Terms:
- Water (Red Label): For Class A fires — paper, wood, textiles. Never use on electrical or flammable liquid fires.
- Foam (Cream Label): For Class A and B fires — solids and flammable liquids. Forms a blanket that smothers the fire.
- CO2 (Black Label): For electrical fires and Class B fires. Leaves no residue, making it ideal for server rooms and labs.
- Powder (Blue Label): Multi-purpose — covers Class A, B, C, and electrical fires. Messy but versatile.

Visual: Cards in a responsive grid (2 columns on desktop). Each card has the term as a heading and the definition as body text. Cards have distinct backgrounds, rounded corners, and equal height. Think "glossary cards."

</div>

---

#### LABELED-IMAGE VARIANTS

<div data-component-type="labeled-image" data-variant="numbered-dots">

**[LABELED-IMAGE — variant: numbered-dots]**
Title: PPE Zones on a Worker
Image: A full-body photograph of a worker wearing complete PPE in a construction environment.
INTERACTIVE: Numbered circular markers on the image. Clicking a marker reveals a tooltip.

Markers:
- x: 50, y: 8, label: Hard Hat, body: Class E hard hat with chin strap. Protects against falling objects and electrical shock up to 20,000V.
- x: 50, y: 18, label: Safety Glasses, body: ANSI Z87.1-rated polycarbonate lenses. Protects against impact, dust, and chemical splash.
- x: 50, y: 35, label: High-Vis Vest, body: Class 2 fluorescent vest with reflective strips. Required in all vehicle movement areas.
- x: 30, y: 50, label: Work Gloves, body: Cut-resistant level A4 gloves with reinforced palm. Required for material handling.
- x: 50, y: 85, label: Steel-Toe Boots, body: ASTM F2413-rated composite toe boots. Protects against compression, impact, and puncture.

Visual: Numbered circular dots (1-5) positioned on the image at the specified coordinates. Clicking a dot opens a small tooltip card with the label and body text. Dots should pulse subtly on load to invite interaction. This is the DEFAULT variant — classic hotspot pattern.

</div>

<div data-component-type="labeled-image" data-variant="side-panel">

**[LABELED-IMAGE — variant: side-panel]**
Title: Emergency Assembly Point Layout
Image: An aerial view of a workplace with marked assembly points, fire exits, and evacuation routes.
INTERACTIVE: Clicking an item in the side panel highlights the corresponding area on the image.

Panel Items:
- Primary Assembly Point (x: 30, y: 70): The main gathering area for all staff during evacuation. Located in the car park, minimum 50 metres from the building.
- Secondary Assembly Point (x: 70, y: 80): Used when the primary point is unsafe (e.g., downwind of a chemical release). Located on the opposite side of the site.
- Fire Exit A — Main Entrance (x: 50, y: 40): The primary evacuation route for ground floor personnel. Leads directly to the primary assembly point.
- Fire Exit B — Rear Loading Bay (x: 80, y: 30): Alternative exit for warehouse staff. Links to the secondary assembly point via the service road.

Visual: Image on the left (60%), scrollable list panel on the right (40%). Each list item has a number badge matching a subtle marker on the image. Clicking/hovering a list item highlights the corresponding location on the image. Active item has an accent border.

</div>

---

#### DATA-TABLE VARIANTS

<div data-component-type="data-table" data-variant="standard">

**[DATA-TABLE — variant: standard]**
Title: Fire Extinguisher Types and Applications
Table:
| Type | Colour Band | Class A (Solids) | Class B (Liquids) | Class C (Gas) | Electrical | Best For |
|---|---|---|---|---|---|---|
| Water | Red | Yes | No | No | No | Paper, wood, textiles |
| Foam | Cream | Yes | Yes | No | No | Offices, warehouses |
| CO2 | Black | No | Yes | No | Yes | Server rooms, labs |
| Powder | Blue | Yes | Yes | Yes | Yes | General purpose |
| Wet Chemical | Yellow | No | Yes (cooking) | No | No | Kitchen fires |

Visual: Clean table with sticky header row, alternating row shading (subtle), and monospace styling on the Yes/No values. Standard presentation — no card wrapper, no elevated shadow. The DEFAULT data-table look.

</div>

<div data-component-type="data-table" data-variant="striped-card">

**[DATA-TABLE — variant: striped-card]**
Title: PPE Requirements by Work Area
Table:
| Work Area | Hard Hat | Safety Glasses | Hi-Vis Vest | Hearing Protection | Steel-Toe Boots |
|---|---|---|---|---|---|
| Office | No | No | No | No | No |
| Warehouse | Yes | Yes | Yes | No | Yes |
| Workshop | Yes | Yes | No | Yes | Yes |
| Laboratory | No | Yes (goggles) | No | No | No |
| Construction Site | Yes | Yes | Yes | Yes | Yes |

Visual: Table presented as an elevated card with rounded corners, subtle shadow, and bold header row with brand accent colour. Stronger alternating row stripes than the standard variant. Overall feel is "reference card you'd pin to a wall." More visual weight than a plain table.

</div>

---

#### BRANCHING VARIANTS

<div data-component-type="branching" data-variant="cards">

**[BRANCHING — variant: cards]**
Title: You Discover a Gas Leak
Body: You smell gas in the stairwell of your office building. No alarm has sounded. What is your FIRST action?

Options:
- Activate the nearest fire alarm to alert the building
- Open windows to ventilate the area before doing anything else
- Leave the building immediately using the stairs and call emergency services from outside
- Search for the source of the leak so you can report its exact location

Visual: Large selectable cards with letter labels (A, B, C, D) arranged in a 2x2 grid. Each card has the option text and a subtle hover effect. Clicking a card highlights it with an accent border and dims the others. This is the DEFAULT branching layout — visual, game-like, with prominent cards.

</div>

<div data-component-type="branching" data-variant="list">

**[BRANCHING — variant: list]**
Title: Prioritise Your Response
Body: A fire alarm sounds while you are in a meeting on the third floor. A colleague in a wheelchair is in the room. Rank these actions by priority — which do you do FIRST?

Options:
- Help the wheelchair user to the designated refuge point on this floor, then evacuate yourself
- Evacuate immediately via the nearest staircase — the fire service will assist disabled colleagues
- Call reception to confirm whether it's a real alarm or a drill before taking action
- Use the lift to help the wheelchair user reach the ground floor quickly

Visual: Compact list format with radio-button or letter-label (A/B/C/D) selection. Less visual space per option than card layout — better for longer text. Selected option highlighted with accent colour. Clean, efficient.

</div>

---

## DESIGN REQUIREMENTS

NOTE: No footer is needed — the course ends with its final section and a completion block. Do NOT design a website-style footer.

1. **Deep-scroll single page** — every section flows naturally into the next with rhythm and breathing room
2. **Responsive** — must work beautifully on both desktop and mobile
3. **Section transitions** — use alternating background tones, spacing, and visual breaks to create a sense of progression
4. **Typography hierarchy** — clear distinction between headings, subheadings, body text, and labels
5. **Interactive elements must include the specified data attributes** for JavaScript hydration:
   - Quizzes: `data-quiz` on container, `data-correct="N"` (zero-indexed), `data-choice` on each option
   - Accordions: Native `<details><summary>` elements
   - Tabs: `data-tabs` on container, `data-tab-trigger` on buttons, `data-tab-panel` on panels
   - Flashcards: `data-flashcard` on card container
   - Checklists: `data-checklist` on container, native `<input type="checkbox">`
   - Carousels: `data-carousel` on container, `data-slide` on slides, `data-prev`/`data-next` on nav buttons
   - Text inputs: Native `<form>` with `<input>` elements
   - Path selectors: `data-path-selector` on container, `data-path-option` on each card, `data-path-variable="{var}"` on each card
6. **Every component wrapper must have `data-component-type="typename"`** for pattern extraction
7. **Components with variants must ALSO have `data-variant="variantname"`** on the wrapper div — this is required for variant-specific pattern extraction
8. **Use Google Material Symbols** for icons: `<span class="material-symbols-outlined">icon_name</span>`
9. **No placeholder or lorem ipsum content** — all text above is the real content to render
10. **Every variant must look visually distinct** — if two variants of the same component look the same, redesign one of them. Variants exist to give courses visual variety.
