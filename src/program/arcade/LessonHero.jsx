import React from 'react';
import {LESSON_PRESENTATION} from '../chapters/presentation.js';

// One hero for every lesson, including the compact first-lesson renderer.
export function LessonHero({chapter,description}){
 const lesson=LESSON_PRESENTATION[chapter.id];
 return <header className="ac-lesson-hero">
  <img className="pg-lesson-art" src={lesson.image} alt="" width="124" height="124" fetchpriority="high"/>
  <div><h1>{lesson.heading}</h1><p>{description||chapter.title}</p></div>
 </header>;
}
