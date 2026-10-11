/** Marker column height in km for a concern index (null = unscored stub). */
export const markerHeight = (index: number | null) => (index === null ? 0.5 : 0.35 + (index / 100) * 2.6);
