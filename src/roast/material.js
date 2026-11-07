// Four registers for the most common feed habits. The joke is about the
// submitted writing; it never invents the author's career or private history.
// Gentle / Honest / Brutal / HR violation.
export const MATERIAL = {
  humbled: {
    partner: ['A rather public announcement of humility.', 'The humility has a communications budget.', 'You have taken humility to market. We would like a piece of the account.', 'A press release about your own modesty. Finally, a business case for shutting down communications.'],
    recruiter: ['The update can stand without the humility announcement.', 'You put your humility on a billboard.', 'You announced your humility to your entire professional network. Was there a launch party?', 'The word “humbled” is doing witness protection for a brag that has already confessed.'],
    intern: ['the humility announcement is a little loud', 'humble, but make it a push notification', 'you put humility on a stage and gave it a ring light', 'this is a victory lap wearing a fake mustache'],
    algorithm: ['Humility submitted for public distribution.', 'Private emotion. Public campaign.', 'Humility detected. Requesting maximum visibility. Please resolve the contradiction.', 'Your humility has requested impressions, comments, and a standing ovation. Request denied.'],
  },
  journey: {
    partner: ['There may be a shorter route to the point.', 'You have rebranded employment as an expedition.', 'The journey appears to be a job with a dramatic travel budget.', 'We mapped the hero’s journey. It starts at a desk and ends at the same desk with a longer email signature.'],
    recruiter: ['Tell me what changed on the journey.', 'The job has a story arc now. Does it still have a salary?', 'Your career has more lore than the job description.', 'This journey needs fewer chapters and one sentence explaining what you actually did.'],
    intern: ['a job can just be a job sometimes', 'the office has a kitchenette, not a quest board', 'a W-2 with world-building. incredible.', 'you have given a calendar invite an origin story'],
    algorithm: ['Journey detected. Destination unspecified.', 'Career update filed under travel fiction.', 'Narrative distance traveled: epic. Concrete information supplied: carry-on only.', 'Your journey has been rerouted. The reader took the nearest exit.'],
  },
  bait: {
    partner: ['Try a question with more than one safe answer.', 'A consultation where the preferred answer is applause.', 'You have built a feedback process with one approved outcome: you being right.', '“Agree?” The entire governance model is a suggestion box that feeds directly into your ego.'],
    recruiter: ['Give people a specific question to answer.', 'You have attached an applause sign to a paragraph.', 'The post ends by asking the reader to complete its performance review.', 'You brought your own standing ovation and now you’re asking us to stand.'],
    intern: ['the like button is already right there', 'this is “please clap” with a question mark', 'you cannot put a tip jar under your own opinion', 'the engagement bait has a little engagement bait at the end. a turducken of need.'],
    algorithm: ['Generic engagement request detected.', 'You have filed a purchase order for validation.', 'Applause requested before any reader has formed an opinion. Efficient.', 'The question is rhetorical. The thirst is not.'],
  },
  buzz: {
    partner: [f=>`${f.n} jargon terms. A plain-language appendix would help.`, f=>`${f.n} buzzwords. You have written a consulting invoice without the consulting.`, f=>`${f.n} buzzwords. We sell this language by the slide, and even we would ask what you mean.`, f=>`${f.n} buzzwords. The sentence has incorporated in Delaware to avoid responsibility for its meaning.`],
    recruiter: [f=>`${f.n} buzzwords are crowding out the work.`, f=>`${f.n} buzzwords. I am looking for a skill, not unlocking a crossword.`, f=>`${f.n} buzzwords. This reads like a job description ate another job description.`, f=>`${f.n} buzzwords and the work is still in witness protection.`],
    intern: [f=>`${f.n} buzzwords. we can say this normally`, f=>`${f.n} buzzwords. the paragraph is wearing a conference lanyard`, f=>`${f.n} buzzwords. this is lorem ipsum with a pension`, f=>`${f.n} buzzwords. even the synergy wants to go home`],
    algorithm: [f=>`${f.n} jargon terms detected. Specific actions would help.`, f=>`${f.n} buzzwords processed. The meaning is still buffering.`, f=>`${f.n} buzzwords. Search results for “what happened”: zero.`, f=>`${f.n} buzzwords. You have successfully encrypted a routine update.`],
  },
  aitells: {
    partner: ['The ornate vocabulary is distracting from the point.', 'The prose has dressed for a keynote the content is not attending.', 'This tapestry has more fabric than substance. Procurement would like a word.', 'The vocabulary arrived in a limousine. The actual point missed the bus.'],
    recruiter: ['Use the word you would say in a conversation.', 'The sentence is auditioning for a more important sentence.', 'This reads like someone ironed every human wrinkle out of it.', 'You have upholstered a routine update in ceremonial language. I am recruiting a person, not furnishing a lobby.'],
    intern: ['the vocabulary is doing a little too much', 'this sentence has a decorative scarf', 'a routine update dressed as the opening ceremony of itself', 'the prose has a velvet rope and absolutely nothing behind it'],
    algorithm: ['Ornate language detected. Authorship unknown.', 'Vocabulary complexity exceeds the job description.', 'The prose has applied for premium status. The meaning is on the free tier.', 'Meaning not found under the decorative language. Please remove the packaging and scan again.'],
  },
  pipes: {
    partner: [f=>`${f.n} separators. A simpler structure would help.`, f=>`${f.n} pipes. Your headline is an org chart with no CEO.`, f=>`${f.n} pipes holding together a merger nobody approved.`, f=>`${f.n} pipes. The personal brand has become a conglomerate with no profitable division.`],
    recruiter: [f=>`${f.n} separators. Lead with the role you want remembered.`, f=>`${f.n} pipes. I need a job title, not a boarding group.`, f=>`${f.n} pipes. Your headline has turnstiles.`, f=>`${f.n} pipes and the actual job title is still waiting to get into its own headline.`],
    intern: [f=>`${f.n} pipes. maybe let one title breathe`, f=>`${f.n} pipes. the headline has a crowd-control problem`, f=>`${f.n} pipes. pick a character. this is not the selection screen`, f=>`${f.n} pipes. your personal brand is three side hustles in a trench coat`],
    algorithm: [f=>`${f.n} delimiters. Primary role unclear.`, f=>`${f.n} pipes. Identity has been split into installments.`, f=>`${f.n} pipes. Your headline needs a traffic controller.`, f=>`${f.n} pipes. Could not extract a job title from the personal-brand plumbing.`],
  },
  passionate: {
    partner: ['Show us what the interest led you to make.', 'Passion is asserted. The supporting exhibit has not arrived.', 'You have declared an emotional relationship with a business function.', 'The passion has been approved by communications and is now indistinguishable from every other passion in the building.'],
    recruiter: ['A concrete example would make this more memorable.', '“Passionate about” is where the useful part of the bio should start.', 'Your passion comes in the same packaging as everyone else’s.', 'The passion is stock photography for a skill you have not described yet.'],
    intern: ['show us the thing you like making', 'the passion has been formatted for linkedin', 'this passion came preinstalled with the profile', 'passion, but in the tone of someone accepting the cookie policy'],
    algorithm: ['Interest detected. Example requested.', 'Passion declared. Differentiating signal pending.', 'Personal passion rendered in the default corporate voice.', 'Your passion is so uniquely yours that it matches the template exactly.'],
  },
  lesson: {
    partner: ['The personal story may not need a business framework.', 'A life event has been acquired by the content department.', 'You have converted a human experience into a lead-generation asset. We usually charge for that.', 'The anecdote has been strip-mined for thought leadership. Please restore the habitat.'],
    recruiter: ['The story can stand without a business lesson attached.', 'A normal experience, now available as a management seminar.', 'You cannot have an experience without making it onboard a sales team.', 'Somewhere inside this leadership lesson is a normal moment begging to remain off LinkedIn.'],
    intern: ['you can have a day without turning it into a lesson', 'the anecdote has been forced to get a job', 'nothing can happen to you without becoming a keynote', 'your real life is being held hostage by your content calendar'],
    algorithm: ['Personal anecdote converted to professional advice.', 'Life event received. Business lesson attached unnecessarily.', 'Your lived experience has been repackaged as a funnel.', 'Even your memories are now required to demonstrate commercial relevance.'],
  },
  mindset: {
    partner: ['Define what the mindset actually changes.', 'The leadership advice has no implementation plan.', 'A mindset is a useful substitute when the slide has no data.', 'We have reviewed the leadership philosophy. It is a mug with an expense account.'],
    recruiter: ['A real decision would tell me more than a slogan.', 'This leadership advice would fit comfortably on a mug.', 'The leadership insight is a motivational poster that learned to type.', 'You have promoted a fridge magnet to head of strategy.'],
    intern: ['a specific example would do more here', 'this is a desktop wallpaper with a job title', 'the leadership lesson is giving airport business book', 'someone get this inspirational mug out of the executive team'],
    algorithm: ['Leadership slogan detected. Example not included.', 'Mindset supplied in place of a concrete action.', 'This insight has the nutritional value of a screensaver.', 'Thought leadership compressed successfully. Output: one fridge magnet.'],
  },
  commentbait: {
    partner: ['Consider sharing the resource directly.', 'The resource has acquired a comment-based toll booth.', 'You have made access to a document contingent on applauding its author.', 'A PDF has been taken hostage. The ransom is engagement.'],
    recruiter: ['A direct link would save everyone a step.', 'The free resource requires a public demonstration of interest.', 'You have turned downloading a document into an audition.', 'It is a link, not the nuclear codes. You can just give it to people.'],
    intern: ['you can just post the link', 'the pdf has a bouncer', 'why does a free document have an initiation ritual', 'a google doc with a velvet rope. we have reached peak linkedin'],
    algorithm: ['Keyword comment gate detected.', 'Download requires a small sacrifice to engagement.', 'Resource access has been converted into a comment farm.', 'The document is free. The dignity is the transaction fee.'],
  },
};
