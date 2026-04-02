import { cleanPdfTextLines, containsDevanagari, normalizeSpaces } from "@/lib/pdf/helpers";
import type {
  OptionLabel,
  ParsedOption,
  ParsedQuestionWithoutAnswer,
} from "@/lib/pdf/types";

interface QuestionBlock {
  number: number;
  lines: string[];
}

interface ParsedSingleLanguageQuestion {
  number: number;
  text: string;
  options: ParsedOption[];
}

function stripInstructionSection(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const markerMatch = normalized.match(/DO NOT OPEN THIS BOOKLET[^\n]*\n/i);

  if (!markerMatch || typeof markerMatch.index !== "number") {
    return text;
  }

  return normalized.slice(markerMatch.index + markerMatch[0].length);
}

function countOptionMarkers(text: string): number {
  return text.match(/\([a-dA-D]\)|(?:^|\s)[a-dA-D]\)/g)?.length ?? 0;
}

function findLikelyQuestionStart(lines: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^1\.\s+\S/.test(lines[index])) {
      continue;
    }

    const nearby = lines.slice(index, index + 120).join("\n");
    if (/\([a-dA-D]\)/.test(nearby) && /\n2\.\s+\S/.test(nearby)) {
      return index;
    }
  }

  return lines.findIndex((line) => /^1\.\s+\S/.test(line));
}

function parseAllQuestionBlocks(lines: string[]): QuestionBlock[] {
  const startIndex = findLikelyQuestionStart(lines);
  if (startIndex < 0) {
    return [];
  }

  const blocks: QuestionBlock[] = [];
  let current: QuestionBlock | null = null;

  for (const line of lines.slice(startIndex)) {
    const match = line.match(/^(\d{1,3})\.\s*(.*)$/);
    if (!match) {
      if (current) {
        current.lines.push(line);
      }
      continue;
    }

    const number = Number(match[1]);
    const body = match[2]?.trim() ?? "";

    if (!current) {
      if (number === 1) {
        current = { number, lines: [body] };
      }
      continue;
    }

    const hasFinishedCurrentQuestion = countOptionMarkers(current.lines.join(" ")) >= 4;
    if (hasFinishedCurrentQuestion && number !== current.number) {
      blocks.push(current);
      current = { number, lines: [body] };
      continue;
    }

    current.lines.push(line);
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function selectOptionWindow(matches: RegExpMatchArray[]): RegExpMatchArray[] {
  if (matches.length <= 4) {
    return matches.slice(0, 4);
  }

  for (let index = 0; index <= matches.length - 4; index += 1) {
    const labels = matches
      .slice(index, index + 4)
      .map((match) => (match[1] ?? "").toUpperCase())
      .join("");

    if (labels === "ABCD") {
      return matches.slice(index, index + 4);
    }
  }

  return matches.slice(0, 4);
}

function parseOptions(content: string): ParsedOption[] {
  const normalizedOptionMarkers = content.replace(/(^|\s)([a-dA-D])\)\s+/g, "$1($2) ");
  const matches = Array.from(normalizedOptionMarkers.matchAll(/\(([a-dA-D])\)\s*/g));
  const selectedMatches = selectOptionWindow(matches);

  if (selectedMatches.length < 4) {
    return [];
  }

  const options: ParsedOption[] = [];
  for (let index = 0; index < 4; index += 1) {
    const currentMatch = selectedMatches[index];
    const nextMatch = selectedMatches[index + 1];
    const start = (currentMatch.index ?? 0) + currentMatch[0].length;
    const end = nextMatch ? nextMatch.index : normalizedOptionMarkers.length;
    const label = currentMatch[1].toUpperCase() as OptionLabel;
    const text = normalizeSpaces(normalizedOptionMarkers.slice(start, end));

    options.push({ label, text });
  }

  return options;
}

function parseQuestionBlock(block: QuestionBlock): ParsedSingleLanguageQuestion | null {
  const merged = normalizeSpaces(block.lines.join(" "));
  const normalizedOptionMarkers = merged.replace(/(^|\s)([a-dA-D])\)\s+/g, "$1($2) ");
  const firstOptionIndex = normalizedOptionMarkers.search(/\([a-dA-D]\)\s*/);

  if (firstOptionIndex < 0) {
    return null;
  }

  const questionText = normalizeSpaces(normalizedOptionMarkers.slice(0, firstOptionIndex));
  const options = parseOptions(normalizedOptionMarkers);

  if (!questionText || options.length < 4) {
    return null;
  }

  return {
    number: block.number,
    text: questionText,
    options,
  };
}

function languageScore(text: string): { latin: number; devanagari: number } {
  return {
    latin: (text.match(/[A-Za-z]/g) ?? []).length,
    devanagari: (text.match(/[\u0900-\u097f]/g) ?? []).length,
  };
}

function pickBestEnglishVariant(variants: ParsedSingleLanguageQuestion[]): ParsedSingleLanguageQuestion {
  return [...variants].sort((a, b) => {
    const scoreA = languageScore(`${a.text} ${a.options.map((option) => option.text).join(" ")}`);
    const scoreB = languageScore(`${b.text} ${b.options.map((option) => option.text).join(" ")}`);

    const valueA = scoreA.latin * 3 - scoreA.devanagari;
    const valueB = scoreB.latin * 3 - scoreB.devanagari;

    return valueB - valueA;
  })[0]!;
}

function pickBestHindiVariant(variants: ParsedSingleLanguageQuestion[]): ParsedSingleLanguageQuestion {
  return [...variants].sort((a, b) => {
    const scoreA = languageScore(`${a.text} ${a.options.map((option) => option.text).join(" ")}`);
    const scoreB = languageScore(`${b.text} ${b.options.map((option) => option.text).join(" ")}`);

    const valueA = scoreA.devanagari * 3 - scoreA.latin;
    const valueB = scoreB.devanagari * 3 - scoreB.latin;

    return valueB - valueA;
  })[0]!;
}

export function parseQuestionPdfText(text: string): ParsedQuestionWithoutAnswer[] {
  const textWithoutInstructions = stripInstructionSection(text);
  const baseLines = cleanPdfTextLines(textWithoutInstructions);

  const parsedVariants = parseAllQuestionBlocks(baseLines)
    .map(parseQuestionBlock)
    .filter((question): question is ParsedSingleLanguageQuestion => Boolean(question));

  const variantsByNumber = new Map<number, ParsedSingleLanguageQuestion[]>();
  for (const variant of parsedVariants) {
    const existing = variantsByNumber.get(variant.number) ?? [];
    existing.push(variant);
    variantsByNumber.set(variant.number, existing);
  }

  const questionNumbers = [...variantsByNumber.keys()].sort((a, b) => a - b);
  if (questionNumbers.length === 0) {
    throw new Error("Could not parse any questions from the question PDF.");
  }

  const mergedQuestions = questionNumbers.map((number) => {
    const variants = variantsByNumber.get(number) ?? [];
    const englishVariant = pickBestEnglishVariant(variants);
    const hindiVariant = pickBestHindiVariant(variants);

    const hindiHasDevanagari =
      containsDevanagari(hindiVariant.text) ||
      hindiVariant.options.some((option) => containsDevanagari(option.text));

    return {
      number,
      textEn: englishVariant.text,
      textHi: hindiHasDevanagari ? hindiVariant.text : englishVariant.text,
      optionsEn: englishVariant.options,
      optionsHi: hindiHasDevanagari ? hindiVariant.options : englishVariant.options,
    };
  });

  return mergedQuestions;
}
