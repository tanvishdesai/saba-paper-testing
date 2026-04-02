import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { discoverPdfPair } from "@/lib/pdf/discoverPdfPair";
import { parsePdfPair } from "@/lib/pdf/parsePdfPair";

describe("parsePdfPair", () => {
  it("parses and maps the sample question/answer PDFs", async () => {
    const pair = discoverPdfPair(process.cwd());
    expect(pair).toBeTruthy();

    const questionPdfBuffer = readFileSync(pair!.questionPath);
    const answerPdfBuffer = readFileSync(pair!.answerPath);

    const parsedTest = await parsePdfPair({
      questionPdfBuffer,
      answerPdfBuffer,
      questionFileName: pair!.questionFileName,
      answerFileName: pair!.answerFileName,
    });

    expect(parsedTest.questions).toHaveLength(100);
    expect(parsedTest.questions[0].number).toBe(1);
    expect(parsedTest.questions[0].correctOption).toBe("C");
    expect(parsedTest.questions[1].correctOption).toBe("D");
    expect(parsedTest.questions[2].correctOption).toBe("A");
    expect(parsedTest.questions.every((question) => question.optionsEn.length === 4)).toBe(true);
    expect(parsedTest.questions.every((question) => question.optionsHi.length === 4)).toBe(true);
    expect(parsedTest.questions.some((question) => /[\u0900-\u097f]/.test(question.textHi))).toBe(
      true,
    );

    const uniqueQuestionNumbers = new Set(parsedTest.questions.map((question) => question.number));
    expect(uniqueQuestionNumbers.size).toBe(100);
  });
});
