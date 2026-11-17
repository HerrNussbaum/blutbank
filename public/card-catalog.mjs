const typeNames = [
  'Advisor',
  'Artifact',
  'Character',
  'Miracle',
  'Reference',
  'Resource',
  'Ritual',
  'Rune',
  'Sovereign',
  'Spell',
  'Token',
  'Training',
];
export const cardTypes = (line) =>
  typeNames.filter(
    (type) =>
      new RegExp('\\b' + type + '\\b', 'i').test(line || '') &&
      !(type === 'Sovereign' && /\bTraining\b/i.test(line || '')),
  );
/** Printing-shaped views are derived for rendering and existing deck references; never stored. */
export function expandCards(catalog) {
  return catalog.flatMap((card) => {
    if (!card.versions)
      return [{ ...card, text: { ...card.text, types: cardTypes(card.text?.typeLine) } }];
    const { versions, sourceId, ...common } = card;
    return versions.map((version) => ({
      ...common,
      ...version,
      original: version.image,
      image: version.image?.includes('bluthelden.com/')
        ? version.image.replace(/([?&])width=\d+/, '$1width=750')
        : version.image,
      gameplayId: card.id,
      gameplaySourceId: sourceId,
      text: {
        ...card.text,
        ...version.text,
        collectorNumber: version.code,
        gameplayId: card.id,
        types: cardTypes(card.text?.typeLine),
      },
    }));
  });
}
