export const cacheTags = {
  songs: () => 'songs',
  song: (songId: string) => `song:${songId}`,
  songPresets: (songId: string) => `song-presets:${songId}`,
  contis: () => 'contis',
  conti: (contiId: string) => `conti:${contiId}`,
  contiByDate: (date: string) => `conti-by-date:${date}`,
  worshipPrep: (date: string) => `worship-prep:${date}`,
  worshipPrepList: () => 'worship-prep-list',
};

export function toIsoDateFromYYMMDD(value: string): string {
  if (!/^\d{6}$/.test(value)) {
    return value;
  }

  return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}
