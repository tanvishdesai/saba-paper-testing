import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { convexApi, createConvexHttpClient } from "@/lib/convex/serverClient";
import { discoverPdfPair } from "@/lib/pdf/discoverPdfPair";
import { parsePdfPair } from "@/lib/pdf/parsePdfPair";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cwd = process.cwd();
    let pair;
    try {
      pair = discoverPdfPair(cwd);
    } catch (fsError) {
      // readdirSync might throw if directory access is weird
      console.warn("Bootstrap discoverPdfPair warning:", fsError);
      pair = null;
    }

    if (!pair) {
      return NextResponse.json(
        { error: "Could not find both a question PDF and an answer PDF in the project root. (On Vercel, this is expected since PDFs are not deployed in the project root)." },
        { status: 404 },
      );
    }

    const [questionPdfBuffer, answerPdfBuffer] = await Promise.all([
      readFile(pair.questionPath).catch(() => null),
      readFile(pair.answerPath).catch(() => null),
    ]);

    if (!questionPdfBuffer || !answerPdfBuffer) {
      return NextResponse.json(
        { error: "Found PDF pair but could not read the files. (On Vercel, this is expected since PDFs are not deployed)." },
        { status: 404 },
      );
    }

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
    console.error("Bootstrap error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
