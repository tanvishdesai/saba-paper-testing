import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface DiscoveredPdfPair {
  questionFileName: string;
  answerFileName: string;
  questionPath: string;
  answerPath: string;
}

function scoreQuestionFile(fileName: string): number {
  if (/\bqp\b/i.test(fileName)) return 4;
  if (/question/i.test(fileName)) return 3;
  if (/test/i.test(fileName)) return 2;
  return 0;
}

function scoreAnswerFile(fileName: string): number {
  if (/\bsol\b/i.test(fileName)) return 4;
  if (/answer/i.test(fileName)) return 3;
  if (/solution/i.test(fileName)) return 3;
  if (/key/i.test(fileName)) return 2;
  return 0;
}

export function discoverPdfPair(directory: string): DiscoveredPdfPair | null {
  const pdfFiles = readdirSync(directory).filter((fileName) => fileName.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length < 2) {
    return null;
  }

  const questionCandidate = [...pdfFiles].sort(
    (a, b) => scoreQuestionFile(b) - scoreQuestionFile(a),
  )[0];
  const answerCandidate = [...pdfFiles]
    .filter((fileName) => fileName !== questionCandidate)
    .sort((a, b) => scoreAnswerFile(b) - scoreAnswerFile(a))[0];

  if (!questionCandidate || !answerCandidate) {
    return null;
  }

  return {
    questionFileName: questionCandidate,
    answerFileName: answerCandidate,
    questionPath: join(directory, questionCandidate),
    answerPath: join(directory, answerCandidate),
  };
}
