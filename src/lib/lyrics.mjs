export function highlightSegments(source, vocabulary) {
  const words = [...new Set(vocabulary)].filter(Boolean);
  const matches = words.flatMap((word) => {
    const result = [];
    for (let start = source.indexOf(word); start !== -1; start = source.indexOf(word, start + 1)) {
      result.push({ start, end: start + word.length, word });
    }
    return result;
  });
  const segments = [];
  for (let index = 0; index < source.length;) {
    const active = matches.filter(({ start, end }) => start <= index && index < end).map(({ word }) => word).sort();
    const previous = segments.at(-1);
    if (previous && previous.words.join('\u0000') === active.join('\u0000')) previous.text += source[index];
    else segments.push({ text: source[index], words: active });
    index += 1;
  }
  return segments;
}
