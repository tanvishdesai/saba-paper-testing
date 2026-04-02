import { basename, extname } from "node:path";

import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { normalizeSpaces, slugify } from "@/lib/pdf/helpers";
import { parseAnswerPdfText } from "@/lib/pdf/parseAnswerPdf";
import { parseQuestionPdfText } from "@/lib/pdf/parseQuestionPdf";
import type { OptionLabel, ParsedTest } from "@/lib/pdf/types";

interface ParsePdfPairInput {
  questionPdfBuffer: Buffer;
  answerPdfBuffer: Buffer;
  questionFileName?: string;
  answerFileName?: string;
  titleOverride?: string;
  slugOverride?: string;
}

function deriveTitle(questionText: string, fallbackName?: string): string {
  const normalized = questionText.replace(/\r\n?/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const detectedLine = lines.find((line) => /GENERAL STUDIES/i.test(line) && /TEST/i.test(line));
  if (detectedLine) {
    return normalizeSpaces(detectedLine.replace(/[\u2013\u2014]/g, "-"));
  }

  if (fallbackName) {
    return basename(fallbackName, extname(fallbackName)).replace(/\s+/g, " ").trim();
  }

  return "Imported Test";
}

function ensureAnswerCoverage(
  questionNumbers: number[],
  answers: Map<number, OptionLabel>,
): Map<number, OptionLabel> {
  const missing = questionNumbers.filter((number) => !answers.has(number));
  if (missing.length > 0) {
    const preview = missing.slice(0, 8).join(", ");
    throw new Error(`Answer key is missing answers for question numbers: ${preview}`);
  }
  return answers;
}

export async function parsePdfPair(input: ParsePdfPairInput): Promise<ParsedTest> {
  const [questionText, answerText] = await Promise.all([
    extractPdfText(input.questionPdfBuffer),
    extractPdfText(input.answerPdfBuffer),
  ]);

  const parsedQuestions = parseQuestionPdfText(questionText);
  const answerMap = parseAnswerPdfText(answerText);
  ensureAnswerCoverage(
    parsedQuestions.map((question) => question.number),
    answerMap,
  );

  const questions = parsedQuestions.map((question) => {
    const correctOption = answerMap.get(question.number);
    if (!correctOption) {
      throw new Error(`Could not find answer for question ${question.number}.`);
    }

    return {
      ...question,
      correctOption,
    };
  });

  const title = input.titleOverride?.trim() || deriveTitle(questionText, input.questionFileName);
  const slugSeed = input.slugOverride?.trim()
    ? input.slugOverride
    : `${title}-${input.questionFileName ?? ""}`;
  const slug = slugify(slugSeed) || `imported-test-${Date.now()}`;

  return {
    slug,
    title,
    sourceQuestionFileName: input.questionFileName,
    sourceAnswerFileName: input.answerFileName,
    questions,
  };
}

