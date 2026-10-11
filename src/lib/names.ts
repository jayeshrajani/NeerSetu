/** "Bairagarh (Sant Hirdaram) kund" → "Bairagarh"; "Shahpura lake ghat" → "Shahpura". */
export const shortName = (name: string) =>
  name
    .split(" (")[0]!
    .split(" /")[0]!
    .replace(/\s+(lake ghat|ghat|kund|dam)$/i, "");
