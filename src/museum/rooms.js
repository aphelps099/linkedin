export const ROOMS = [
  {
    id: 'humble-brags',
    wing: 'Wing I',
    room: 'Gallery 01',
    title: 'Hall of Humble Brags',
    subtitle: 'Personal milestones, professionally leveraged.',
    description: 'Six canonical works from the period when every ordinary human event became a leadership framework.',
    exhibitNos: ['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06'],
  },
];

export function exhibitsForRoom(room, exhibits){
  const byNo = new Map(exhibits.map(exhibit => [exhibit.no, exhibit]));
  return room.exhibitNos.map(no => byNo.get(no)).filter(Boolean);
}
