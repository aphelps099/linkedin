// Shared art direction for the homepage posters and invitation link previews.
const designs={
 standup:{paper:'#fff16b',ink:'#162929',accent:'#0757ec',lines:[['NEW','FOLDER.','BIG ENERGY.'],['STRONG','FOLDER','MOMENTUM.']],stamp:'QUICK SYNC'},
 onboarding:{paper:'#0757ec',ink:'#fff8eb',accent:'#ffb9dc',lines:[['YOU’RE','IN.','KIND OF.'],['WELCOME','TO THE','WAITING.']],stamp:'ACCESS PENDING'},
 unlock:{paper:'#ffb9dc',ink:'#282036',accent:'#0757ec',lines:[['UNTAPPED.','UNMUTED.'],['NEXT CHAPTER.','SAME TAB.']],stamp:'POTENTIAL INSIDE'},
 paperless:{paper:'#e9e5d9',ink:'#253b30',accent:'#0757ec',lines:[['PAPERLESS.*'],['DIGITAL.','PLEASE','PRINT.']],stamp:'*PLEASE PRINT'},
 founder:{paper:'#17372e',ink:'#e5ff8d',accent:'#ffb9dc',lines:[['HUMBLED.','HONORED.','ON MUTE.'],['BIG NEWS.','NO PRODUCT.']],stamp:'EXCLUSIVE UPDATE'},
 offline:{paper:'#ff814f',ink:'#252021',accent:'#0757ec',lines:[['LET’S TAKE','THIS','OFFLINE.'],['LESS MEETING.','MORE','MEETINGS.']],stamp:'YOU’RE STILL HERE'},
 quarterly:{paper:'#b8d7fb',ink:'#103569',accent:'#0757ec',lines:[['BIG Q3','ENERGY.'],['ALL SIGNS','POINT TO','ALIGNMENT.']],stamp:'NUMBERS OPTIONAL'},
};
export function meetingPoster(meeting){const design=designs[meeting.agenda]||designs.standup;return {...design,lines:design.lines[meeting.variant||0]};}
