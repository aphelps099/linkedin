# The Lexicon

The band's vocabulary, for LinkedIn Beats.

**Synergy sings the post. The band answers in the lexicon.**

Today every song lands on the same four words. This file is the way out: 135 expressions people overuse on LinkedIn and in machine-written posts, 71 contrast couplets ("It's not X. It's Y."), 16 call-and-response exchanges, the lady's 57 recordings sorted by what they can do, and the casting rules that keep any of it from becoming the next "Let's circle back". `lexicon.json` is the same bank as data for the build: every entry has its voice, its measured words, its length, its roles and its topics.

Lengths are seconds of voice. The lady's come from `lady-phrases.json`. Synthia's were rendered offline with Flite `slt` and her season chain (pitch 1.04). Strategy's come from his 5 existing Kokoro masters where one already says the line; every other Strategy length is a Flite render times 1.12, the median Kokoro/Flite ratio of his 13 takes (range 0.757 to 1.352), marked `~`. Nothing was sent to ElevenLabs, OpenAI or `/api/voice`.

## 0. The problem, counted

`castSong` over the sample and the 60 fixtures, as shipped:

| Line | Where it plays | Posts | Why |
|---|---|---|---|
| "Let's build." (50) | her ladder: 42 to 50 hits a song | 51 of 61 | 48 because nothing in the post beat it; 3 because the post is about building |
| "Let's circle- BACK." (06) | the tag, the silence, the impact | 44 of 61 | 22 the Circle Back title bonus, 21 nothing beat it, 1 the post says it |
| "Let's circle back" | Synergy's sign-off (song.js `HOST.close`) | 61 of 61 | fixed, every track |
| Both of her lines |  | 35 of 61 |  |
| Today's whole cast, all eight roles |  | 20 of 61 |  |

The rest of today's cast is stuck the same way: "Full stop." on 60, "Let that sink in" on 55, "Read that again." on 54, "Pivot" on 53, "Leverage" on 46. Forced to one song, Circle Back casts "Let's circle- BACK." on 60 of 61 posts, and every song casts "Let's build." on 51 to 53.

The flagship makes it worse. The sample post's own hook is "Let's keep building", so in Circle Back Synergy sings it on 6 lines over 42 of her "Let's build." hits: about fifty builds in sixty seconds. That is the chorus Aaron is hearing. Of her 57 recordings, 11 are cast on no post at all (Delve, the template, "a calling" among them) and 32 more on only one or two.

## 1. The lady's 57, by family

What she says, how long it is, what it plays today (`lady-roles.json`; `*` is today's default), what it can play in the lexicon, and on how many of the 61 posts it is cast today.

**Announcements.** The opener. Something has happened, and it happened to the poster.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 01 | I'm thrilled to announce | 1.72 | lift, sink | refrain, call | 1 |
| 03 | I'm happy to share that I'm starting a new position | 3.62 | bend, lift, sink, tag |  | 1 |
| 04 | After careful reflection, I've decided to pursue new opportunities | 4.35 | bend, lift, sink | call | 1 |
| 17 | I'm excited to share… | 1.33 | ladder, lift, sink | refrain, call | 1 |
| 30 | Delighted to have joined… | 1.40 | lift, sink | call | 2 |
| 38 | Big news. | 1.02 | ladder, punct, sink | call | 1 |
| 39 | Some personal news. | 1.26 | stop, lift, sink, tag | call | 1 |
| 40 | A quick update. | 1.30 | ladder, punct, stop, lift, sink | call | 1 |

**Gratitude and pride.** Thanks, aimed upward or at a team that did the work.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 27 | Grateful for this incredible journey. | 2.05 | stop, bend, lift, sink | stab, refrain | 3 |
| 28 | Couldn't have done it without my amazing team. | 2.47 | stop, bend, lift, sink, tag |  | 1 |
| 47 | Proud of this team. | 1.11 | stop, sink, tag | refrain | 6 |
| 48 | Milestone unlocked. | 1.62 | stop, sink | answer | 1 |

**Humility.** Winning, said softly.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 02 | Humbled and honored to share | 1.77 | bend, lift, sink, tag | refrain, call, stab | 1 |
| 49 | This one's personal. | 2.21 | stop, lift, sink | call | 0 |

**Story beats.** The parable: a small moment, a big lesson, a barista.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 19 | Here's what I learned. | 1.17 | stop, sink, tag | call | 0 |
| 20 | This changed everything for me. | 2.03 | stop, lift, sink |  | 0 |
| 23 | I'll say what nobody else will… | 1.98 | lift, sink, tag | call | 4 |
| 24 | A small moment that taught me a big lesson. | 2.83 | ladder, punct, stop, bend, lift, sink | call | 1 |
| 25 | And then he said something I'll never forget. | 2.42 | ladder, punct, stop, bend, sink | call | 2 |
| 42 | Lessons learned. | 0.94 | punct, stop, bend, sink, tag | answer | 3 |
| 43 | Here's the takeaway. | 1.08 | stop, lift, sink | call | 1 |

**Axioms.** Thought leadership in four words or fewer. Includes the contrast couplet.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 09 | It's not about the tools. It's about the mindset. | 3.01 | stop, sink | couplet, ladder | 1 |
| 22 | It's not about X. It's about Y. | 3.41 | sink | refrain, couplet, ladder | 0 |
| 33 | Not just a job, a calling. | 2.32 | stop, lift, sink | couplet | 0 |
| 52 | The numbers don't lie. | 1.37 | ladder, stop, bend, lift, sink | answer | 2 |
| 53 | Execution beats strategy. | 1.75 | stop, lift, sink |  | 1 |
| 54 | Culture is everything. | 2.14 | lift, sink | refrain, couplet | 0 |
| 55 | Feedback is a gift. | 1.33 | stop, bend, lift, sink | refrain, couplet | 0 |
| 56 | Failure is just data. | 1.59 | ladder, stop, bend, lift, sink | couplet | 1 |
| 57 | Momentum compounds. | 1.35 | stop, lift, sink | refrain, couplet | 2 |

**Jargon.** Meeting words. They mean less the more often they are said.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 11 | A rich tapestry | 0.94 | stop, lift, sink | refrain, answer | 0 |
| 31 | In today's fast-paced world… | 2.02 | lift, sink | call | 1 |
| 32 | Passionate about driving impact at the intersection of… | 2.71 | bend, lift, sink, tag | call | 2 |

**Calls to action.** Engagement bait and commands to the reader.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 14 | Agree or disagree? | 1.10 | bend, lift, sink | call, answer, stab | 1 |
| 15 | Let that sink in | 2.24 | sink* |  | 55 |
| 18 | Read that again. | 1.04 | punct*, stop, lift, sink, tag |  | 54 |
| 21 | Most people won't understand this. But you will. | 3.55 | ladder, punct, stop, lift, sink, tag | call | 1 |
| 34 | Hot take: teamwork makes a difference. | 2.65 | ladder, punct, stop, lift, tag | call | 1 |
| 35 | Unpopular opinion: Fridays are great. | 3.52 | stop, lift, sink | call | 1 |
| 36 | Let's connect and explore synergies. | 2.14 | ladder, punct, stop, bend, lift, sink | call | 3 |
| 37 | What do you think? Drop a comment below. | 2.30 | ladder, punct, stop, bend, sink, tag | call | 2 |

**Closers.** The last line. Usually a promise of more.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 06 | Let's circle back | 1.09 | ladder, sink, tag* | call | 44 |
| 16 | Full stop. | 1.01 | ladder, punct, stop* |  | 60 |
| 26 | The rest is history. | 1.24 | stop, lift, sink |  | 2 |
| 29 | Onwards and upwards! | 2.38 | stop, lift | refrain | 1 |
| 41 | The journey continues. | 1.33 | stop, bend, lift, sink | refrain, sign-off | 1 |
| 44 | We're just getting started. | 1.28 | ladder, stop, lift, sink, tag | sign-off | 3 |
| 45 | More to come. | 0.95 | punct, stop, sink, tag | refrain, sign-off | 1 |
| 46 | Stay tuned. | 0.93 | punct, stop, sink, tag | sign-off | 1 |
| 50 | Let's build. | 0.80 | ladder*, punct, stop, sink, tag |  | 51 |
| 51 | Watch this space. | 1.63 | stop, sink | call | 0 |

**Punchy single words.** One word, said like a verdict.

| File | She says | Length | Today | In the lexicon | Posts |
|---|---|---|---|---|---|
| 05 | Synergy | 1.01 | punct, stop, lift | stab, answer, couplet | 3 |
| 07 | Leverage | 1.17 | punct, stop, lift* | stab, answer, couplet | 46 |
| 08 | Pivot | 0.68 | punct, stop, bend*, lift | stab, answer, couplet | 53 |
| 10 | Delve | 0.86 | punct | stab, answer, couplet | 0 |
| 12 | Game-changer | 1.51 | punct | stab, answer, couplet | 0 |
| 13 | Thoughts? | 0.52 | punct | call, stab | 1 |

What the inventory says:

- **She already owns the brand device.** 22 is "It's not about X. It's about Y.", the template itself, letters included. 09 ("It's not about the tools. It's about the mindset.") and 33 ("Not just a job, a calling.") are filled-in couplets. None of the three is cast on any post today.
- **"It's not" is a ladder nobody has cut.** 09 and 22 both open on it: about 0.36 s, its first word 0.17 s, inside every ladder limit (first word 0.30 s, phrase 0.85 s). Climbing, it is a denial getting louder. Two takes, so a round can alternate them. Needs `fits()`, the pitch check and Whisper before it ships.
- **Her 18 tag cuts are underused.** One of them (06) plays on 44 posts; the other 17 share the rest. Her 15 ladder cuts: one plays on 51.
- **Her stabs:** Synergy, Leverage, Pivot, Delve, Game-changer, Thoughts?, and single words cut from longer takes (Humbled, Grateful, Agree, Culture, Momentum, Feedback).
- **Her refrains:** the phrases with open vowels that loop cleanly: "Onwards and upwards!", "The journey continues.", "More to come.", "Humbled and honored to share", "Grateful for this incredible journey.", "Culture is everything.", "Momentum compounds.", "A rich tapestry", and the template.
- **Her calls:** "Thoughts?", "Agree or disagree?", "What do you think?", "Hot take:", "Unpopular opinion:", "Big news.", "A quick update.", "Let's connect": each one is a question the band can answer.

## 2. The expression bank

135 expressions: 62 the lady already says, 36 for Strategy (5 of them existing takes), 37 for Synthia.

**Who carries a line.** The lady, if one of her 57 recordings says it, cut on her measured words; never a splice across two recordings. Otherwise Strategy or Synthia, rendered new. Strategy (Kokoro `am_onyx`, .95, low and deliberate) takes the authority lines: the confession in a couplet, the jargon of power, hustle, the sign-offs. His treatment is **pixel**: a bit-crushed, sample-held take, not a vocoder, tuned to the pentatonic. Synthia (Flite `slt`, 1.04, clean and dry) takes the trainer lines: the reframe, the AI tells, wellness, the engagement calls. She is the fluent player, so her lines may wander furthest. Synergy keeps the post and hosts, and sings none of the lexicon except, in Circle Back, his sign-off. Aaron asked for less of the distorted robot and more Strategy and Synthia; this is where that comes from.

**Sings** is how far a line can be pushed into melody. *Sings*: open vowels on the stressed syllables, ends voiced or on a short stop, loops, survives +12 semitones. *Chants*: clear on one note or as a stab; ends on a cluster or a sibilant that hisses if pitched up. *Speaks*: only as spoken word, because the joke needs speech rhythm or the line is too long.

**Means** is what the expression means at work. The Peg Board shows the expression; this column is for us.

### Announcements

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| I'm thrilled to announce | 5 | 1.66 | sings | lady 01 | refrain, call, sink | Something happened, and it happened to me. |
| Thrilled to share | 3 | 0.89 | sings | Synthia | refrain, call | A smaller thing, at the same volume. |
| Proud and humbled to announce | 7 | ~1.95 | sings | Strategy | refrain, call | Two feelings that cancel out, announced anyway. |
| Proud to announce | 4 | ~1.16 | sings | Strategy | call, refrain | Legal has approved the pride. |
| I'm excited to share | 6 | 1.28 | sings | lady 17 | refrain, call, ladder, lift, sink | A link follows. |
| I'm happy to share that I'm starting a new position | 14 | 2.65 | speaks | lady 03 | tag, sink, bend | Same laptop, new lanyard. |
| Delighted to have joined | 6 | 1.28 | chants | lady 30 | call, lift, sink | Day three. Still no access. |
| Big news. | 2 | 0.83 | sings | lady 38 | call, ladder, punct, sink | Medium news. |
| Some personal news. | 5 | 1.20 | chants | lady 39 | call, tag, sink | Professional news, said quietly. |
| A quick update. | 4 | 0.93 | chants | lady 40 | call, ladder, punct, stop | It is not quick. |
| After careful reflection | 7 | 1.46 | chants | lady 04 | call | It was reflected on for me. |
| Excited for this next chapter | 8 | 1.96 | chants | Synthia | sign-off, answer | The last chapter ended at 9:02 on a Tuesday. |
| Please join me in congratulating | 9 | ~2.36 | speaks | Strategy | call | Someone else's promotion, about me. |

### Gratitude and pride

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Grateful | 2 | 0.42 | sings | lady 27 | stab, bend, lift | Placed first, so it counts. |
| Grateful for this incredible journey. | 10 | 1.78 | sings | lady 27 | refrain, sink, stop | It has ended. |
| Couldn't have done it without my amazing team. | 12 | 2.41 | chants | lady 28 | tag, sink | They did it. |
| Proud of this team. | 4 | 0.99 | sings | lady 47 | tag, sink, refrain | They shipped. I posted. |
| Milestone unlocked. | 4 | 1.57 | chants | lady 48 | stop, sink, answer | A badge in the app. |
| Huge shout-out | 3 | 0.96 | chants | Synthia | stab, call | A tag, with feelings. |
| Forever grateful | 5 | 1.16 | sings | Synthia | refrain, sign-off | Contract ends in June. |
| Blessed | 1 | 0.53 | chants | Synthia | stab | Bonus season. |
| Couldn't be prouder | 5 | ~1.08 | sings | Strategy | refrain, call | Could, with a budget. |

### Humility

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Humbled and honored to share | 7 | 1.74 | sings | lady 02 | refrain, call, tag, sink | I won something. |
| I'm humbled and honored to share a small update. | 12 | 2.35 | speaks | Strategy (take) | call | The common audition line. He has already read it, so it costs nothing. |
| Humbled | 2 | 0.50 | sings | lady 02 | stab, lift | Elevated, quietly. |
| This one's personal. | 5 | 1.94 | chants | lady 49 | sink, stop, call | It is about my brand. |
| Let me be vulnerable for a second | 11 | ~2.11 | speaks | Strategy | call | Exactly one second. |
| I'll be honest | 4 | ~1.12 | chants | Strategy | call | Starting now. |
| Imposter syndrome | 5 | 1.22 | chants | Synthia | call, stab | Confidence, with a footnote. |
| Stay humble | 3 | ~0.95 | sings | Strategy | sign-off, answer, refrain | Posted, to everyone. |

### Story beats

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| I'll say what nobody else will | 8 | 1.74 | chants | lady 23 | call, tag, lift, sink | Everyone said it on Tuesday. |
| A small moment that taught me a big lesson. | 11 | 2.58 | chants | lady 24 | call, ladder, sink, bend | There is always a barista. |
| And then he said something I'll never forget. | 11 | 2.36 | speaks | lady 25 | call, ladder, bend, sink | Nobody else heard it. |
| Here's what I learned. | 4 | 0.93 | chants | lady 19 | call, tag, sink, stop | Seven bullet points and a selfie. |
| This changed everything for me. | 7 | 1.97 | chants | lady 20 | sink, lift | Nothing changed for anyone else. |
| Lessons learned. | 3 | 0.89 | chants | lady 42 | punct, tag, sink, answer | Lessons listed. |
| Here's the takeaway. | 5 | 1.03 | chants | lady 43 | call, sink, stop, lift | Below the selfie. |
| Learnings | 2 | 0.61 | chants | Synthia | stab, answer | Lessons, with a budget code. |
| Plot twist | 2 | ~0.78 | speaks | Strategy | stab, call | It was the intern. |
| Here's the thing | 3 | ~0.94 | chants | Strategy | call | There is no thing. |
| Ask me how I know | 5 | ~1.21 | chants | Strategy | call, answer | Please do not ask. |

### Axioms

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| It's not about X. It's about Y. | 9 | 2.72 | sings | lady 22 | refrain, couplet, sink | The template. Fill in both. |
| It's not about the tools. It's about the mindset. | 12 | 2.93 | chants | lady 09 | couplet, sink, stop | We bought the tools. |
| Not just a job, a calling. | 7 | 2.26 | chants | lady 33 | couplet, sink, stop | Overtime, spiritually. |
| The numbers don't lie. | 5 | 1.32 | chants | lady 52 | sink, ladder, stop, answer | Selected numbers. |
| Execution beats strategy. | 8 | 1.70 | chants | lady 53 | sink, lift, stop | Strategy has been informed. |
| Culture is everything. | 6 | 1.89 | sings | lady 54 | refrain, sink, lift | Except the budget. |
| Feedback is a gift. | 5 | 1.29 | chants | lady 55 | sink, stop, bend, refrain | Non-returnable. |
| Failure is just data. | 6 | 1.53 | chants | lady 56 | sink, ladder, stop | Stored indefinitely. |
| Momentum compounds. | 5 | 1.28 | sings | lady 57 | refrain, sink, lift | So do meetings. |
| Trust the process | 4 | ~1.38 | chants | Strategy | refrain, call, answer | Do not read the process. |
| Growth mindset | 3 | 0.96 | chants | Synthia | stab, refrain | Growth, of the mind only. |
| And that's okay. | 4 | 0.91 | sings | Synthia | answer, stop, refrain | It is not okay. |
| Rise and grind | 3 | ~1.16 | sings | Strategy | refrain, call | 5 a.m., for the photo. |
| No days off | 3 | ~1.02 | sings | Strategy | refrain, answer, sign-off | And it shows. |
| In this economy | 6 | ~0.97 | chants | Strategy | call, refrain, answer | Said to justify anything. |

### Jargon

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| In today's fast-paced world | 6 | 1.96 | chants | lady 31 | call, sink | The first line, every time. |
| Passionate about driving impact at the intersection of | 16 | 2.70 | speaks | lady 32 | call, lift, bend, tag | Of what, it does not say. |
| North star | 2 | ~0.82 | sings | Strategy | stab, refrain, answer | A metric you cannot see in daylight. |
| Move the needle | 4 | ~1.06 | sings | Strategy | refrain, call | Which needle is next quarter's meeting. |
| Bandwidth | 2 | ~0.43 | chants | Strategy | stab, answer | The polite form of no. |
| Let's double-click on that | 6 | 1.33 | chants | Synthia | call | Open it. Look. Close it. |
| Low-hanging fruit | 4 | ~1.04 | sings | Strategy | refrain, call | Picked by the last team. |
| Deep dive | 2 | 0.72 | chants | Synthia | stab, call | Forty slides in the shallow end. |
| Alignment | 3 | ~0.67 | sings | Strategy | stab, answer | Everyone agrees to meet again. |
| Stakeholders | 3 | ~1.30 | chants | Strategy | stab | Not invited, and noticed. |
| Touch base | 2 | 0.73 | chants | Synthia | stab, call | A meeting to schedule the meeting. |
| We'll take this offline. | 5 | 1.62 | chants | Strategy (take) | sign-off, answer, call | We won't. |
| Per my last email | 5 | 1.38 | chants | Synthia | answer, call, refrain, sign-off | Read it. |
| Boil the ocean | 4 | ~1.03 | sings | Strategy | refrain | We will not. Until Q3. |
| Paradigm shift | 4 | ~0.99 | chants | Strategy | stab | A new template for the deck. |
| Ecosystem | 4 | 0.92 | chants | Synthia | stab | Our other products. |
| Ownership | 3 | ~0.65 | chants | Strategy | stab, answer | Your problem now. |
| Unlock the potential. | 6 | 1.46 | chants | Strategy (take) | refrain, call | It was locked for a reason. |

### AI tells

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Delve | 1 | 0.81 | sings | lady 10 | stab, punct, answer | To read, if a machine wrote it. |
| A rich tapestry | 5 | 0.92 | sings | lady 11 | refrain, lift, sink, answer | Of nouns. |
| A testament to | 5 | 0.82 | chants | Synthia | call | To the prompt. |
| Navigate the complexities | 8 | 1.87 | chants | Synthia | refrain, call | Of a calendar invite. |
| Elevate | 3 | 0.44 | sings | Synthia | stab, answer | Raise, in a press release. |
| Seamless | 2 | 0.45 | chants | Synthia | stab, answer | The seams are on another team. |
| Robust | 2 | 0.47 | chants | Synthia | stab, answer | Untested. |
| In the ever-evolving landscape | 9 | 1.90 | chants | Synthia | call, refrain | Of the same four apps. |
| It's important to note | 6 | 1.31 | speaks | Synthia | call | Nothing important follows. |
| In the realm of | 4 | 0.82 | chants | Synthia | call | A kingdom of one spreadsheet. |
| Foster a culture of | 6 | 1.08 | chants | Synthia | call | Book a workshop. |
| Agentic | 3 | ~0.75 | chants | Strategy | stab, answer | It sends the email itself. |
| AI-first | 3 | ~0.57 | chants | Strategy | stab, answer | People second. |
| Human in the loop | 5 | 0.92 | sings | Synthia | refrain, answer | One human. A long loop. |
| The future of work | 5 | ~1.05 | sings | Strategy | refrain, call | Fewer people at it. |
| In conclusion | 4 | 0.89 | chants | Synthia | stop, sign-off | The machine is done. |
| Great question | 3 | 1.00 | chants | Synthia | answer | It was not a question. |

### Culture and wellness

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Bring your whole self | 4 | 1.07 | sings | Synthia | refrain, call | Within reason. |
| Protect your peace | 4 | 1.13 | sings | Synthia | refrain, answer | Mute the channel. |
| Hold space | 2 | 0.90 | sings | Synthia | stab, refrain, answer | Book a room. |
| We're a family | 5 | ~0.82 | sings | Strategy | refrain, call | With a performance plan. |
| Boundaries | 3 | 0.77 | chants | Synthia | stab | Set at 11 p.m. |
| Wellness | 2 | 0.56 | chants | Synthia | stab | An app, provided. |

### Calls to action

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Most people won't understand this. But you will. | 11 | 3.45 | speaks | lady 21 | call, tag, ladder, punct | Sent to everyone. |
| Let's connect and explore synergies. | 9 | 2.08 | chants | lady 36 | call, ladder, sink, stop | An invite with no agenda. |
| Agree or disagree? | 6 | 1.07 | chants | lady 14 | call, sink, lift, bend | Agree. |
| Agree | 2 | 0.43 | sings | lady 14 | answer, stab, bend | Yes. |
| What do you think? | 4 | 0.74 | chants | lady 37 | call, punct, tag | Below, publicly. |
| Drop a comment below. | 6 | 1.21 | chants | lady 37 | call, ladder, punct | The algorithm is listening. |
| Let's connect | 3 | 0.74 | chants | lady 36 | call, ladder, punct | Accept, then silence. |
| Hot take: | 2 | 0.67 | chants | lady 34 | call, ladder, punct, tag | Room temperature. |
| Unpopular opinion: | 7 | 1.30 | chants | lady 35 | call, lift | A popular opinion, posted early. |
| Read that again. | 4 | 0.96 | chants | lady 18 | punct, sink, tag | It is the same. |
| Let that sink in | 4 | 2.18 | sings | lady 15 | sink | Two seconds of nothing. |
| Repost if you agree | 6 | 1.43 | chants | Synthia | call | Repost either way. |
| Follow for more | 4 | 0.89 | chants | Synthia | call, sign-off | There is more. |
| Link in the comments | 5 | 1.26 | chants | Synthia | call, answer | Scroll. Keep scrolling. |
| Let's discuss | 3 | ~1.04 | chants | Strategy | call | In the comments, never in person. |
| Be honest. | 3 | ~0.66 | chants | Strategy | call | Within guidelines. |
| DM me | 3 | 0.65 | chants | Synthia | call, answer | I'll send the deck. |

### Closers

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Let's circle back (demoted) | 4 | 1.04 | sings | lady 06 | tag, ladder, sink, call | Never. |
| Onwards and upwards! | 5 | 2.34 | sings | lady 29 | refrain, lift, stop | Sideways, mostly. |
| The journey continues. | 6 | 1.28 | sings | lady 41 | refrain, stop, sink, sign-off | No destination was approved. |
| We're just getting started. | 6 | 1.22 | chants | lady 44 | tag, ladder, stop, sink, sign-off | Year nine. |
| More to come. | 3 | 0.89 | sings | lady 45 | refrain, punct, tag, sink, sign-off | Nothing scheduled. |
| Stay tuned. | 2 | 0.86 | sings | lady 46 | punct, tag, sink, sign-off | Do not change the channel. |
| Watch this space. | 3 | 1.16 | chants | lady 51 | sink, stop, call | It will stay empty. |
| The rest is history. | 6 | 1.18 | sings | lady 26 | stop, sink, lift | The rest is a funding round. |
| Full stop. | 2 | 0.82 | chants | lady 16 | stop, ladder, punct | Then four more paragraphs. |
| Let's build. (demoted) | 2 | 0.75 | chants | lady 50 | ladder, punct, stop | Retired as everyone's ladder. Kept for posts about building. |
| Same time next week | 4 | ~1.31 | sings | Strategy | sign-off, answer | Recurring. No end date. |
| Let's go | 2 | 0.59 | sings | Synthia | stab, call | Nobody moves. |
| Here's to what's next | 4 | 1.31 | sings | Synthia | sign-off, stop | Unannounced, for a reason. |

### Punchy single words

| Expression | Syl. | Length | Sings | Voice | Roles | Means |
|---|---|---|---|---|---|---|
| Synergy | 3 | 0.70 | sings | lady 05 | stab, lift, punct, stop, answer | Two teams, one headcount. |
| Leverage | 3 | 0.64 | sings | lady 07 | lift, stab, punct, answer | Use, invoiced. |
| Pivot | 2 | 0.46 | chants | lady 08 | bend, stab, punct, answer | The plan, failing gracefully. |
| Offline. | 2 | 0.83 | chants | Strategy (take) | stab, answer | Where decisions go. |
| Optimize. | 3 | 0.89 | chants | Strategy (take) | stab, answer | Fewer people, same work. |
| Game-changer | 3 | 0.86 | chants | lady 12 | punct, stab, answer | A new dropdown. |
| Thoughts? | 1 | 0.47 | chants | lady 13 | call, punct, stab | Comments, please. Any comments. |
| This. | 1 | ~0.44 | chants | Strategy | stab, answer | A complete review of someone else's post. |

## 3. It's not X. It's Y.

The anthem device. A post wants to say the honest thing and then the approved thing; LinkedIn Beats lets it say both. X is concrete and slightly too honest. Y is the reframe someone was paid to write. Straight face, both times.

**Who sings it.** Strategy confesses: "It's not a layoff." Low, deliberate, pixel, like the minutes being read back. Synthia corrects him: "It's a launch." Clean, bright, on the beat, the trainer with the approved term. When the lady owns Y, she answers instead and her sample is the irony: Strategy, "It's not a cult."; the lady, "Culture." (54). Synthia sings the "It's" or "It's a" in front of her word as a pickup. 10 couplets end on her.

**The 12 strongest:**

| Topic | It's not | It's | Y sung by | Drop on |
|---|---|---|---|---|
| layoffs | a pink slip | a permission slip | Synthia | anthem only |
| layoffs | a cardboard box | a starter kit | Synthia | HH HU OF |
| layoffs, culture | a reorg | a remix | Synthia | CB HH HU OF |
| ai | autocomplete | thought leadership | Synthia | anthem only |
| ai | a hallucination | a hypothesis | Synthia | anthem only |
| hustle, metrics | a second job | a side hustle | Synthia | HH OF |
| hustle, culture | unpaid | a calling | the lady (33 [4-5]) | anthem only |
| wellness, promotions | a raise | a meditation app | Synthia | anthem only |
| wellness, meetings | a sick day | async | Synthia | CB HH HU OF |
| meetings | an hour | a quick sync | Synthia | CB HH HU OF |
| culture | a cult | culture | the lady (54 [0]) | anthem only |
| metrics | a vanity metric | a north star | Synthia | CB HH HU OF |

**The drop version.** A couplet can replace "Let's circle- BACK." without breaking the form. Strategy sings "It's not an hour." over the build's first two bars, between her slow rungs, where Synergy's answers sit today. The band chokes. Synthia's tag: "It's a quick-". The silence, 0.392 s as always. The impact: "SYNC.", vocoded on the tonic, her deep echo an octave down. The joke is still the missing word. The impact rules still hold (one word, one or two syllables, under a beat minus 40 ms: CB 0.46 s, HH 0.55 s, HU 0.42 s, OF 0.52 s) and the tag still fits the choke window (CB 0.61 s, HH 0.74 s, HU 0.74 s, OF 0.74 s at the recording's speed). By Flite's measure, with Synthia rendered up to 1.25x faster where needed, **30 couplets can be the drop on at least one track and 17 on all four**. A lady impact (Pivot, gift, data) means Synthia tags and the lady lands the word: two recordings across the choke, which `drop.js` does not do yet.

On one couplet drop in three, her ladder becomes the denial itself: "It's not", climbing from a bar apart to a 1/32, until the room chokes on it.

**The anthem.** In Drop B and the outro, the couplet becomes the chorus: two to four couplets on the post's topic, a bar each, Strategy and Synthia trading. Then the lady sings the template back, "It's not about X. It's about Y." (22), looping and wandering while the next couplets arrive. It replaces the third and later repeats of Synergy's hook. For a layoffs post:

> **Strategy:** It's not a layoff. **Synthia:** It's a launch.
> **Strategy:** It's not a pink slip. **Synthia:** It's a permission slip.
> **Strategy:** It's not a cardboard box. **Synthia:** It's a starter kit.
> **Strategy:** It's not a reorg. **Synthia:** It's a remix.
> **The lady:** It's not about X. It's about Y.

For a post about AI: autocomplete and thought leadership, a hallucination and a hypothesis, your replacement and your new teammate, then her own "It's not about the tools. It's about the mindset." (09) instead of the template. For a meeting: an hour and a quick sync, a decision and a next step, avoidance and camera off (Pat, every meeting), then the template.

**Her recorded couplets** (nothing to render):

| File | She says | X half | Y half | Use |
|---|---|---|---|---|
| 22 | It's not about X. It's about Y. | 1.29 s | 1.05 s | The anthem refrain: the template, sung back after the band fills it in. |
| 09 | It's not about the tools. It's about the mindset. | 1.32 s | 1.20 s | An AI post's couplet, whole, in her voice. |
| 33 | Not just a job, a calling. | 1.16 s | 0.73 s | Culture and hustle. "A calling." also answers the unpaid couplet. |

**All 71, by topic.** Every X is unique and so is every Y. Lengths: X line is Strategy (estimated), Y line is Synthia (Flite) or the lady (her cut plus Synthia's pickup). "Drop on" lists the tracks where Y can be the impact.

### Layoffs

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| a layoff (brief) | a launch | Synthia | 5 / 3 | ~1.10 / 0.87 | IT'S A- LAUNCH. (HH OF) |  |
| a pink slip **(top 12)** | a permission slip | Synthia | 5 / 6 | ~1.29 / 1.15 |  |  |
| a cardboard box **(top 12)** | a starter kit | Synthia | 6 / 5 | ~1.77 / 1.00 | IT'S A STARTER- KIT. (HH HU OF) |  |
| a reorg **(top 12)** | a remix | Synthia | 5 / 4 | ~1.23 / 0.78 | IT'S A- REMIX. (CB HH HU OF) | culture |
| a severance package | a care package | Synthia | 8 / 5 | ~1.99 / 1.15 | IT'S A CARE- PACKAGE. (HH OF) |  |
| attrition | alumni | Synthia | 5 / 4 | ~1.19 / 0.87 |  | culture |
| a hiring freeze | a focus season | Synthia | 6 / 6 | ~1.62 / 1.33 | IT'S A FOCUS- SEASON. (HH HU OF) | metrics |
| an exit interview | a listening tour | Synthia | 8 / 6 | ~1.85 / 1.20 |  | culture |
| a skeleton crew | a tiger team | Synthia | 7 / 5 | ~1.77 / 1.14 | IT'S A TIGER- TEAM. (CB HH HU OF) | hustle |
| a merger | synergy | lady 05 [0] | 5 / 4 | ~1.14 / 0.94 |  | meetings |

### AI

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| autocomplete **(top 12)** | thought leadership | Synthia | 6 / 5 | ~1.51 / 1.19 |  |  |
| a hallucination **(top 12)** | a hypothesis | Synthia | 8 / 6 | ~1.98 / 1.17 |  |  |
| a ghostwriter | my authentic voice | Synthia | 6 / 6 | ~1.51 / 1.41 |  |  |
| your replacement | your new teammate | Synthia | 6 / 5 | ~1.61 / 1.19 | IT'S YOUR NEW- TEAMMATE. (CB HH HU OF) | layoffs |
| copy-paste | co-creation | Synthia | 5 / 5 | ~1.68 / 1.19 |  |  |
| a chatbot | a colleague | Synthia | 5 / 4 | ~1.23 / 0.98 | IT'S A- COLLEAGUE. (HH OF) | culture |
| a guess | a forecast | Synthia | 4 / 4 | ~1.21 / 1.11 |  | metrics |
| reading | delve | lady 10 [0] | 4 / 2 | ~1.10 / 1.05 |  | "It's delve" is bad grammar on purpose: the machine wrote it. |
| an app update | a game-changer | lady 12 [0] | 6 / 5 | ~1.56 / 1.35 |  | metrics |

### Hustle

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| overtime (brief) | ownership | Synthia | 5 / 4 | ~1.53 / 0.91 |  |  |
| insomnia | a morning routine | Synthia | 6 / 6 | ~1.43 / 1.31 | IT'S A MORNING- ROUTINE. (HH HU OF) | wellness |
| a Saturday | a hackathon | Synthia | 6 / 5 | ~1.25 / 1.06 |  |  |
| a fifth espresso | discipline | Synthia | 7 / 4 | ~1.69 / 0.77 |  |  |
| a second job **(top 12)** | a side hustle | Synthia | 6 / 5 | ~1.57 / 1.27 | IT'S A SIDE- HUSTLE. (HH OF) | metrics |
| a cold shower | a cold plunge | Synthia | 6 / 4 | ~1.58 / 1.21 | IT'S A COLD- PLUNGE. (HH) | wellness |
| sleep deprivation | the edge | Synthia | 7 / 3 | ~1.96 / 0.70 | IT'S THE- EDGE. (CB HH HU OF) | wellness |
| unpaid **(top 12)** | a calling | lady 33 [4-5] | 4 / 4 | ~1.30 / 0.97 |  | culture |

### Wellness

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| burnout (brief) | bandwidth | Synthia | 4 / 3 | ~1.20 / 0.61 | IT'S- BANDWIDTH. (CB HH HU OF) |  |
| a pizza party | a wellness initiative | Synthia | 7 / 8 | ~1.65 / 1.52 |  | culture |
| a raise **(top 12)** | a meditation app | Synthia | 4 / 7 | ~1.09 / 1.29 |  | promotions |
| a sick day **(top 12)** | async | Synthia | 5 / 3 | ~1.31 / 0.74 | IT'S- ASYNC. (CB HH HU OF) | meetings |
| a vacation | a workation | Synthia | 6 / 5 | ~1.66 / 1.19 |  | hustle |
| a lunch break | a lunch and learn | Synthia | 5 / 5 | ~1.44 / 1.22 |  | meetings |

### Promotions

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| a demotion | a lateral opportunity | Synthia | 6 / 10 | ~1.49 / 1.67 |  |  |
| more work | a stretch assignment | Synthia | 4 / 6 | ~1.10 / 1.39 |  | hustle |
| a pay cut | equity | Synthia | 5 / 4 | ~1.20 / 0.69 |  | metrics |
| a gift card | recognition | Synthia | 5 / 5 | ~1.55 / 1.06 |  | culture |
| a bigger desk | a seat at the table | Synthia | 6 / 7 | ~1.37 / 1.42 |  |  |
| a new title | growth | Synthia | 6 / 2 | ~1.61 / 0.66 | IT'S- GROWTH. (CB HH HU OF) |  |

### Meetings

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| an hour **(top 12)** | a quick sync | Synthia | 4 / 4 | ~1.19 / 1.01 | IT'S A QUICK- SYNC. (CB HH HU OF) |  |
| a reply-all | transparency | Synthia | 6 / 5 | ~1.41 / 1.27 |  | culture |
| a delay | a dependency | Synthia | 5 / 6 | ~1.19 / 1.21 |  | metrics |
| a no | a not right now | Synthia | 4 / 5 | ~1.06 / 1.19 | IT'S A NOT RIGHT- NOW. (CB HH HU OF) |  |
| a mistake | a learning | Synthia | 5 / 4 | ~1.48 / 0.84 | IT'S A- LEARNING. (CB HH OF) | culture |
| silence | a parking lot | Synthia | 4 / 5 | ~1.14 / 1.00 |  |  |
| a pre-meeting | alignment | Synthia | 6 / 4 | ~1.41 / 0.79 |  |  |
| a status update | visibility | Synthia | 7 / 6 | ~1.71 / 0.95 |  |  |
| a forty-slide deck | a narrative | Synthia | 7 / 5 | ~2.20 / 0.91 |  |  |
| a recurring meeting | a ritual | Synthia | 8 / 5 | ~1.70 / 0.95 |  | culture |
| an agenda | a vibe | Synthia | 6 / 3 | ~1.24 / 0.68 | IT'S A- VIBE. (CB HH HU OF) | culture |
| a decision | a next step | Synthia | 6 / 4 | ~1.29 / 1.10 | IT'S A NEXT- STEP. (CB HH HU OF) |  |
| double-booked | in demand | Synthia | 5 / 4 | ~1.37 / 0.85 | IT'S IN- DEMAND. (CB HH HU OF) | hustle |
| avoidance | camera off | Synthia | 5 / 5 | ~1.14 / 0.88 | IT'S CAMERA- OFF. (CB HH HU OF) | culture. Pat, every meeting. |
| a U-turn | a pivot | lady 08 [0] | 5 / 4 | ~1.41 / 0.95 | IT'S A- PIVOT. (CB HH OF) | metrics |

### Culture

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| a performance plan | a family | Synthia | 7 / 5 | ~1.96 / 0.88 |  |  |
| a ping-pong table | an employer brand | Synthia | 7 / 6 | ~1.94 / 1.54 |  |  |
| a complaint | a gift | lady 55 [2-3] | 5 / 3 | ~1.34 / 0.85 | IT'S A- GIFT. (HH) | meetings |
| mandatory | a retreat | Synthia | 6 / 4 | ~1.42 / 0.81 | IT'S A- RETREAT. (CB HH HU OF) | wellness |
| an open-plan office | collaboration | Synthia | 8 / 6 | ~1.86 / 1.19 |  |  |
| a hot desk | flexibility | Synthia | 5 / 6 | ~1.42 / 1.19 |  |  |
| a cult **(top 12)** | culture | lady 54 [0] | 4 / 3 | ~1.10 / 0.86 |  |  |
| a lanyard | belonging | Synthia | 5 / 4 | ~1.10 / 1.06 |  |  |

### Metrics

| It's not | It's | Y | Syl. | Length | Drop | Also |
|---|---|---|---|---|---|---|
| a vanity metric **(top 12)** | a north star | Synthia | 8 / 4 | ~1.53 / 1.14 | IT'S A NORTH- STAR. (CB HH HU OF) |  |
| a rounding error | momentum | lady 57 [0] | 7 / 4 | ~1.61 / 0.77 |  | hustle |
| a miss | a stretch goal | Synthia | 4 / 4 | ~1.13 / 1.25 | IT'S A STRETCH- GOAL. (HH OF) |  |
| a loss | an investment | Synthia | 4 / 5 | ~1.15 / 1.15 |  |  |
| churn | graduation | Synthia | 3 / 5 | ~1.23 / 1.16 |  |  |
| cherry-picking | just data | lady 56 [2-3] | 6 / 4 | ~1.51 / 0.97 | IT'S JUST- DATA. (HH OF) |  |
| one customer | a segment | Synthia | 6 / 4 | ~1.51 / 0.79 | IT'S A- SEGMENT. (CB HH HU OF) |  |
| a down quarter | a reset year | Synthia | 6 / 5 | ~1.68 / 1.02 | IT'S A RESET- YEAR. (CB HH HU OF) |  |
| a loan | leverage | lady 07 [0] | 4 / 4 | ~1.12 / 0.88 |  |  |

"(brief)" marks the three examples of tone the brief gave; every other couplet is new. Topics are tags for casting, not a rating of who deserves the joke: every couplet is about the work and the language around it, never about a person, a company or a group.

## 4. Song roles and casting

### The roles

| Role | What it is | Who | Where it sits |
|---|---|---|---|
| Refrain | A short phrase (2 to 9 syllables) that loops a bar or two and wanders: each repeat takes a new path through the pentatonic, the last one resolves home. | the lady (retuned per vowel, as the ladder is), Synthia, Strategy | Drop A from its second bar, Drop B, the outro; in Offsite a round, like her ladder |
| Couplet | It's not X. It's Y. As the drop: "It's not X." over the build's first two bars (where Synergy answers today), then the tag "It's a-", the silence, and Y as the impact. As the anthem: two to four couplets, a bar each, then the template. | Strategy sings X; Synthia, or the lady when she owns the word, sings Y | the build, the tag and the impact; Drop B and the outro, in place of the hook's later repeats |
| Call | Opens an exchange; another voice answers. | usually the lady | the end of a verse line, the gap before Drop B |
| Answer | Closes an exchange in one to four words, deadpan. | Strategy or Synthia | right after its call, in the same bar |
| Stab | One word, said like a verdict. | anyone; the lady's are best | today's bend, lift and punct gaps; an offbeat in the verse |
| Sign-off | The last line before the tape stop, in place of Synergy's fixed "Let's circle back". | the line's own voice; Synergy only for "Let's circle back" in Circle Back | where "Let's circle back" is today (Circle Back bar 28) |

Her existing roles keep their names and limits (`ladder`, `tag`, `impact`, `bend`, `lift`, `sink`, `punct`, `stop`); the bank lists which of them each of her lines can play.

**Exchanges** (call, then answer):

| Call | Answer | Note |
|---|---|---|
| Thoughts? (the lady) | Aligned. (Strategy) |  |
| Agree or disagree? (the lady) | Agree (the lady) | She answers herself. |
| What do you think? (the lady) | Per my last email (Synthia) |  |
| Hot take: (the lady) | Room temperature. (Strategy) |  |
| Unpopular opinion: (the lady) | Ten thousand likes. (Synthia) |  |
| Big news. (the lady) | Same team. New logo. (Strategy) |  |
| A quick update. (the lady) | Forty slides. (Synthia) |  |
| Let's connect (the lady) | Pending. (Synthia) |  |
| Stay tuned. (the lady) | Nothing scheduled. (Synthia) |  |
| We're just getting started. (the lady) | Year nine. (Strategy) |  |
| Watch this space. (the lady) | It stays empty. (Strategy) |  |
| Full stop. (the lady) | Paragraph two. (Strategy) |  |
| Let's circle back (the lady) | Same time next week (Strategy) | Circle Back's new sign-off: the title, then the recurring invite. |
| Bandwidth? (Strategy) | None. (Synthia) |  |
| Let's double-click on that (Synthia) | Nothing there. (Strategy) |  |
| Delve (the lady) | Great question (Synthia) | The machine compliments the machine. |

### Replacing the default chorus

|  | Today (the sample, Circle Back) | With the lexicon |
|---|---|---|
| The hook | "Let's keep building", Synergy, 6 lines | still the post's words, but Synergy sings it at most three times: the verse, Drop A, once in Drop B |
| The ladder | "Let's build.", 42 hits | her ladder cast by topic and rotation; "It's not" on a third of the couplet drops |
| Tag and impact | "Let's circle- BACK." | one of her tags, or a couplet drop ("It's a quick- SYNC."); Circle Back keeps its title on one song in four |
| Drop B | the hook, three more times | a refrain, or the anthem: couplets and the template |
| Sign-off | "Let's circle back", Synergy | rotates by track: "We'll take this offline.", "Same time next week", "Stay humble", "The journey continues." |

"Let's build." is demoted, not deleted: it plays when the post is about building (the sample, fixture 40). The sample's hook stays its own words; whether the flagship film keeps today's cast is a question for Aaron (below).

### The casting rules

Casting stays pure: the same post, seed and history give the same song.

1. **The post first.** A line the post says outright (its text, or the couplet's X or Y) wins its slot, as today (+2.5 relevance).
2. **Topic match.** Every lexicon line carries casting.js concepts; couplets carry brand topics (layoffs: layoffs, farewell; ai: ai; hustle: grind, productivity, momentum, execution, speed; wellness: wellness, vibes; promotions: career, pride, milestone, humility, announce, gratitude; meetings: meeting, process, jargon, strategy; culture: culture, workfamily, retreat, belonging, feedback, hiring; metrics: data, growth, money). A line scores its strongest topic group plus half the next, so a line tagged with more topics is not louder.
3. **Home track.** Each family and topic has a home (announcements and gratitude in Humbled and Honored, jargon and calls in Circle Back, AI, hustle, layoffs and metrics in Hustle, culture, wellness and closers in Offsite): +0.6 at home.
4. **Rotation by post hash.** Lines within a margin of the best are settled by FNV-1a of the post, salted per slot (drop, ladder, refrain, anthem, sign-off), so similar posts spread and the slots do not move together. The margin is wide for the anthem (1.2) and the refrain (0.6), narrow for the drop and ladder (0.35).
5. **Freshness.** `castSong(post, {recent})` takes the lexicon keys used in the last songs, per slot. A line used in the last 3 songs scores x0.15; in the last 10, x0.5. The page can keep its own short history per viewer; a batch render passes the queue's.
6. **Couplet drops on purpose.** The drop is a couplet on about 40% of posts by hash, and always when the post argues "not X, it's Y" itself or a couplet scores 2 on topic.
7. **Circle Back keeps its name.** "Let's circle- BACK." plays on one Circle Back song in four, by hash, and nowhere else unless the post says it.
8. **Never at a person.** A post that matches casting.js `SENSITIVE` (family, health, grief), unless it is the work-family joke, gets no couplet drop and only meetings and metrics couplets in its anthem. 6 of the 61 posts.
9. **Per song:** one drop, one ladder, one refrain, up to three anthem couplets, one sign-off. No recording twice, no lexicon line twice, no content word twice across the hook and the band (today's -0.8 rule).

**Fallback order,** per slot, when nothing clears 0.7 of relevance (1.0 for the sign-off):

1. the post says it;
2. topic match;
3. the track's house rotation for the slot (4 to 7 lines each, in `lexicon.json` `casting.house`), by hash and freshness;
4. the evergreen set, lines that fit any post: "Hot- TAKE.", the reorg remix, "It's not about X. It's about Y.", "More to come.", "Same time next week";
5. today's line, last.

### The rules, tried

A sketch of these rules (scratch code, not the build's) over the same 61 posts, once from the hash alone and once rendered in order with history:

|  | Today | Hash only | With history |
|---|---|---|---|
| Distinct ladders | 10 | 15 | 16 |
| Most-cast ladder | LET'S BUILD. (51) | BIG LESSON. (9) | IT'S NOT (9) |
| Distinct drops (tag and impact) | 9 | 28 | 35 |
| Most-cast drop | LET'S CIRCLE- BACK. (44) | PROUD OF THIS- TEAM. (10) | LET'S CIRCLE- BACK. (6) |
| Couplet drops | 0 | 21 | 22 |
| "Let's build." ladders | 51 | 4 | 4 |
| "Let's circle- BACK." drops | 44 | 6 | 6 |
| "Let's circle back" sign-offs | 61 | 4 | 4 |
| Distinct sign-offs | 1 | 14 | 14 |
| Distinct refrains | 0 | 26 | 33 |
| Couplets used (drop and anthem) | 0 | 56 | 58 |
| Most uses of one couplet |  | 8 | 7 |
| Same drop two songs running |  | 3 | 3 |

The build should assert these as checks, from the hash alone: no ladder on more than 12 posts, no drop on more than 10, no refrain on more than 6, no couplet on more than 8, no sign-off on more than 10; at least 14 ladders, 25 drops and 25 refrains; "Let's build." on 6 posts at most. Topic match decides 85% of the drops; the house rotation the rest. Meetings is the widest topic (45 of 61 posts touch it) and has the most couplets for that reason.

What it casts, for a few posts (with history):

| Post | Song | Drop | Ladder | Refrain | Anthem | Sign-off |
|---|---|---|---|---|---|---|
| sample | Circle Back | PROUD OF THIS- TEAM. | LET'S BUILD. | UNLOCK THE POTENTIAL. | a pre-meeting / alignment; double-booked / in demand | PER MY LAST EMAIL |
| fixture 1 | Hustle | IT'S NOT YOUR REPLACEMENT. IT'S YOUR NEW- TEAMMATE. | IT'S NOT | IN THE EVER-EVOLVING LANDSCAPE | an exit interview / a listening tour; a reorg / a remix | NO DAYS OFF |
| fixture 13 | Humbled and Honored | IT'S NOT A NEW TITLE. IT'S- GROWTH. | I'M EXCITED | HUMBLED AND HONORED TO SHARE | more work / a stretch assignment; a demotion / a lateral opportunity | FOREVER GRATEFUL |
| fixture 14 | Offsite | WHAT DO YOU- THINK? | BIG LESSON. | HOLD SPACE | a pre-meeting / alignment; a U-turn / a pivot | STAY TUNED. |
| fixture 25 | Hustle | IT'S NOT SLEEP DEPRIVATION. IT'S THE- EDGE. | BUT YOU WILL. | NO DAYS OFF | a cold shower / a cold plunge; overtime / ownership | IN CONCLUSION |
| fixture 34 | Hustle | IT'S NOT AN HOUR. IT'S A QUICK- SYNC. | IT'S NOT | RISE AND GRIND | insomnia / a morning routine; a cold shower / a cold plunge | NO DAYS OFF |
| fixture 47 | Offsite | IT'S NOT A SICK DAY. IT'S- ASYNC. | LET'S CIRCLE | WE'RE A FAMILY | a performance plan / a family; a ping-pong table / an employer brand | STAY TUNED. |
| fixture 52 | Hustle | IT'S NOT ONE CUSTOMER. IT'S A- SEGMENT. | DON'T LIE. | IN THIS ECONOMY | cherry-picking / just data; a miss / a stretch goal | IN CONCLUSION |
| fixture 59 | Circle Back | LET'S CIRCLE- BACK. | LET'S BUILD. | IT'S NOT ABOUT X. IT'S ABOUT Y. | a pre-meeting / alignment; a decision / a next step | LET'S CIRCLE BACK |

Fixture 1 ("I fired our entire sales team... the AI agents don't take lunch") gets "It's not your replacement. It's your new- TEAMMATE." Fixture 25 says "This is the edge" and its drop ends on the edge. Fixture 47 says "We're a family" and its anthem answers with the performance plan. Fixture 59 argues "Accountability isn't a meeting. It's a mirror." and gets the template back as its refrain. Fixture 14 (a grandmother, every Sunday) is a sensitive post: no couplet drop, and only meeting couplets in its anthem. The sample keeps "Let's build." because its own post says building.

## 5. Open questions for Aaron

1. **Decided (Aaron, Nov 5): the lady keeps her 57 recordings for now.** Strategy and Synthia carry every new word. The wish list below stays for later. Her voice is the brand's sample. If ElevenLabs credits are fine, the 26-line wish list in `lexicon.json` (343 characters) gives her the couplet frame ("It's", "It's a", "It's not" as clean single takes), the impact words (launch, remix, async, sync, growth) and the best new vocabulary (north star, bandwidth, learnings, in this economy, the future of work...). It has to be the same ElevenLabs voice and settings as the 57: `server/voice-service.js` names a default voice, but nothing in the repo says the 57 were recorded with it, or with which settings. Without credits, Strategy and Synthia carry all of it, free and offline.
2. **Strategy confesses, Synthia reframes.** Or the other way round: Synthia states the honest word like a machine that cannot lie, and Strategy lands the spin with authority. The first puts more Strategy on the board; the second puts him on the downbeat.
3. **Layoffs.** Ten couplets joke about layoffs. All of them aim at the euphemism, none at the people let go, and the sensitivity rule keeps them off personal posts. Is that the line, or should layoffs sit out?
4. **The flagship.** The sample post keeps today's cast exactly ("it is the flagship film"). Its own hook is "Let's keep building". Should the flagship move to the lexicon too, or stay as the before?
5. **Circle Back's name.** One Circle Back song in four keeps "Let's circle- BACK."; Synergy's "Let's circle back" sign-off stays only in Circle Back. Enough, or retire it from the drop entirely?
6. **How pixel is Strategy?** A crushed take that Whisper still understands, or crushed until only the shape of the word is left on the downbeat?
7. **Synergy's share.** The hook drops to three repeats and the band takes the rest. Should he also lose the verse's longer lines to Strategy, or stay the one voice that sings the post?
