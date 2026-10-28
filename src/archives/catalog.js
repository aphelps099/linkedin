import {DISPATCHES} from '../home-2/dispatches.js';
import {EXHIBITS} from '../museum/exhibits.js';

export const CATEGORIES = [
  ['all', 'Everything'], ['press', 'Press releases'], ['posts', 'Posts & notes'],
  ['roasts', 'Hall of Fame'], ['films', 'Films'], ['music', 'Music'], ['features', 'Features'],
];
const categoryFor = {press:'press', post:'posts', blog:'posts', video:'films', song:'music', feature:'features'};
export const ARCHIVE_ITEMS = [
  ...DISPATCHES.map(item => ({...item, category:categoryFor[item.type]})),
  ...EXHIBITS.slice(0,6).map(exhibit => ({
    id:`hall-of-fame-${exhibit.no.toLowerCase()}`, type:'roast', category:'roasts', label:'Hall of Fame',
    title:exhibit.title, shape:'square', exhibit,
    description:exhibit.plaque, body:exhibit.body.split('\n\n'),
  })),
];
export function filterArchive(category, query='') {
  const needle=query.trim().toLowerCase();
  return ARCHIVE_ITEMS.filter(item => (category==='all'||item.category===category) &&
    [item.title,item.label,item.description,...(item.body||[])].filter(Boolean).join(' ').toLowerCase().includes(needle));
}
