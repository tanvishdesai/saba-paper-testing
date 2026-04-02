import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { convexApi, createConvexHttpClient } from "@/lib/convex/serverClient";
import { discoverPdfPair } from "@/lib/pdf/discoverPdfPair";
import { parsePdfPair } from "@/lib/pdf/parsePdfPair";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cwd = process.cwd();
    const pair = discoverPdfPair(cwd);

    if (!pair) {
      return NextResponse.json(
        { error: "Could not find both a question PDF and an answer PDF in the project root." },
        { status: 404 },
      );
    }

    const [questionPdfBuffer, answerPdfBuffer] = await Promise.all([
      readFile(pair.questionPath),
      readFile(pair.answerPath),
    ]);

    const parsedTest = await parsePdfPair({
      questionPdfBuffer,
      answerPdfBuffer,
      questionFileName: pair.questionFileName,
      answerFileName: pair.answerFileName,
    });

    const mutationQuestions = parsedTest.questions.map((question) => ({
      ...question,
      // Backward-compatible aliases for deployments still expecting text/options.
      text: question.textEn,
      options: question.optionsEn,
    }));

    const client = createConvexHttpClient();
    const existing = await client.query(convexApi.tests.getTestBySlug, {
      slug: parsedTest.slug,
    });

    await client.mutation(convexApi.tests.upsertParsedTest, {
      slug: parsedTest.slug,
      title: parsedTest.title,
      sourceQuestionFileName: parsedTest.sourceQuestionFileName,
      sourceAnswerFileName: parsedTest.sourceAnswerFileName,
      questions: mutationQuestions,
    });

    return NextResponse.json({
      bootstrapped: true,
      replacedExisting: Boolean(existing),
      slug: parsedTest.slug,
      title: parsedTest.title,
      questionCount: parsedTest.questions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap sample test.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
