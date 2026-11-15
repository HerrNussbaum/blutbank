// Advisory checks based on Stylguide Karttext.xlsx, sheet1 (A3:C27).
// {T} is Octenarius' stored form of the guide's printed (T) symbol.
export function cardStyleIssues(card) {
  const issues = [];
  const add = (rule, field, line, message, excerpt) =>
    issues.push({ rule, field, line, message, excerpt });
  for (const field of ['rulesText', 'additionalCostsText']) {
    const raw = String(card.text?.[field] || '');
    // Don't interpret reminder explanations as operative rules.
    const text = raw.replace(/\((?!T\)|Binding\))[^()]*\)/gi, (match) =>
      match.replace(/[^\n]/g, ''),
    );
    const originalLines = raw.split('\n');
    for (const [index, source] of text.split('\n').entries()) {
      const line = source.trim();
      if (!line) continue;
      const flag = (rule, message) => add(rule, field, index + 1, message, line);
      if (
        /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:DMG|LP|HP)\b/i.test(line) ||
        /\b(?:put|remove)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)\b[^.:]*\bCounters?\b/i.test(
          line,
        )
      )
        flag(
          'numbers',
          'Mengen für Schaden, Regeneration und Marken möglichst als Ziffer schreiben (Zeilen 5, 19, 21).',
        );
      if (/\bCreate\s+\d+\s+(?:\d+\s*\/\s*\d+\s+)?[^.:]*\bTokens?\b/i.test(line))
        flag(
          'token-number',
          'Token-Anzahl prüfen: Die Token-Vorlage verwendet ein Zahlwort (Zeile 27; allgemeine Zahlenempfehlung in Zeile 21 weicht ab).',
        );
      if (/\b\d+\s+ASP\b/i.test(line) && !/\{\d+\}\s+ASP/i.test(line))
        flag('asp-symbol', 'ASP-Menge als Symbol {X} schreiben, z. B. {2} ASP (Zeile 3).');
      if (/\[(?:T|Binding)\]|\{(?:Tap|Turn|Binding)\}/i.test(line))
        flag(
          'symbol',
          'Turn- bzw. Binding-Symbol prüfen: (T) und (Binding); {T} ist intern ebenfalls zulässig (Zeilen 4, 6).',
        );
      const colon = line.indexOf(':');
      if (colon > -1) {
        const cost = line.slice(0, colon);
        const asp = cost.search(/\{(?:\d+|X)\}/i),
          turn = cost.search(/\{T\}|\(T\)/);
        if (
          asp >= 0 &&
          ((turn >= 0 && turn < asp) || (cost.slice(0, asp).trim() && !/^If\b/i.test(cost)))
        )
          flag(
            'cost-order',
            'Kostenreihenfolge prüfen: erst ASP, dann Turnsymbol, dann Zusatzkosten (Zeile 10).',
          );
        else if (
          turn > 0 &&
          !/^If\b/i.test(cost) &&
          cost.slice(0, turn).replace(/\{(?:\d+|X)\}|[\s,]/gi, '')
        )
          flag('cost-order', 'Turnsymbol vor Zusatzkosten setzen (Zeile 10).');
        if (
          /\{T\}|\(T\)|\{(?:\d+|X)\}/.test(cost) &&
          /\w/.test(line.slice(colon + 1)) &&
          !/[.!?:]["”')]*$/.test(originalLines[index].trim()) &&
          !/^(?:Rise|Pool|Binding)$/i.test(line.slice(colon + 1).trim())
        )
          flag(
            'effect-stop',
            'Aktivierten Effekt mit einem Punkt abschließen; zusammengehörige Fortsetzungen mitprüfen (Zeile 10).',
          );
      }
      if (/\b(?:INI|RES)\s+[+−-]\s*\d/.test(line))
        flag('stat-format', 'Statusmodifikation direkt anschließen, z. B. INI+2 (Zeile 26).');
      if (
        /\b(?:When|Whenever)\b/.test(line) &&
        card.name &&
        new RegExp(
          '\\b(?:When|Whenever)\\s+' +
            card.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            '(?:\\b|,)',
          'i',
        ).test(line)
      )
        flag(
          'self-reference',
          'Selbstreferenz prüfen: möglichst „this [Kartentyp]“ statt des Kartennamens (Zeile 18).',
        );
      if (/\bWhenever\s+1\s+(?:Character|Artifact|Resource|Ritual)\b/i.test(line))
        flag(
          'trigger-count',
          '„1“ und „a“ haben unterschiedliche Auslösebedingungen. Falls irgendeine Karte gemeint ist, „a“ verwenden (Zeile 20).',
        );
    }
  }
  return issues;
}
