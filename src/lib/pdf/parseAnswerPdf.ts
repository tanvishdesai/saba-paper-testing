import type { OptionLabel } from "@/lib/pdf/types";

const ANSWER_PATTERNS = [
  /\bQ\s*(\d{1,3})\s*[\.\-:]\s*\(?([A-D])\)?\b/gi,
  /\bQuestion\s*(\d{1,3})\s*[\.\-:]\s*\(?([A-D])\)?\b/gi,
];

export function parseAnswerPdfText(text: string): Map<number, OptionLabel> {
  const answers = new Map<number, OptionLabel>();

  for (const pattern of ANSWER_PATTERNS) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const questionNumber = Number(match[1]);
      const option = match[2].toUpperCase() as OptionLabel;
      answers.set(questionNumber, option);
    }
    pattern.lastIndex = 0;
  }

  if (answers.size === 0) {
    const lineRegex = /^\s*(\d{1,3})\s*[\.\-:]\s*\(?([A-D])\)?\s*$/gim;
    let match: RegExpExecArray | null;
    while ((match = lineRegex.exec(text)) !== null) {
      const questionNumber = Number(match[1]);
      const option = match[2].toUpperCase() as OptionLabel;
      answers.set(questionNumber, option);
    }
  }

  if (answers.size === 0) {
    throw new Error("Could not parse answers from the answer PDF.");
  }

  return answers;
}
