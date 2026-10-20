import {hook} from './01-hook.js';
import {inflation} from './02-inflation.js';
import {vocabulary} from './03-vocabulary.js';
import {shape} from './04-shape.js';
import {single} from './05-single.js';

// Five lessons, one per notch on the dial. Order is the curriculum.
export const CHAPTERS = [hook, inflation, vocabulary, shape, single];
export const chapterById = id => CHAPTERS.find(c => c.id === id);
