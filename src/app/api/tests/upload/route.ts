import { NextResponse } from "next/server";

import { convexApi, createConvexHttpClient } from "@/lib/convex/serverClient";
import { parsePdfPair } from "@/lib/pdf/parsePdfPair";

export const runtime = "nodejs";

function asFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === "string") {
    return null;
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const questionPdf = asFile(formData.get("questionPdf"));
    const answerPdf = asFile(formData.get("answerPdf"));
    const titleOverride = String(formData.get("title") ?? "").trim();

    if (!questionPdf || !answerPdf) {
      return NextResponse.json(
        { error: "Please provide both a question PDF and an answer-key PDF." },
        { status: 400 },
      );
    }

    if (!questionPdf.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Question file must be a PDF." }, { status: 400 });
    }

    if (!answerPdf.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Answer file must be a PDF." }, { status: 400 });
    }

    const [questionPdfBuffer, answerPdfBuffer] = await Promise.all([
      questionPdf.arrayBuffer().then((buffer) => Buffer.from(buffer)),
      answerPdf.arrayBuffer().then((buffer) => Buffer.from(buffer)),
    ]);

    const parsedTest = await parsePdfPair({
      questionPdfBuffer,
      answerPdfBuffer,
      questionFileName: questionPdf.name,
      answerFileName: answerPdf.name,
      titleOverride: titleOverride || undefined,
    });

    const mutationQuestions = parsedTest.questions.map((question) => ({
      ...question,
      // Backward-compatible aliases for deployments still expecting text/options.
      text: question.textEn,
      options: question.optionsEn,
    }));

    const client = createConvexHttpClient();
    const result = await client.mutation(convexApi.tests.upsertParsedTest, {
      slug: parsedTest.slug,
      title: parsedTest.title,
      sourceQuestionFileName: parsedTest.sourceQuestionFileName,
      sourceAnswerFileName: parsedTest.sourceAnswerFileName,
      questions: mutationQuestions,
    });

    return NextResponse.json({
      message: "Test parsed and saved successfully.",
      testId: result.testId,
      slug: parsedTest.slug,
      title: parsedTest.title,
      questionCount: parsedTest.questions.length,
      replacedExisting: result.replacedExisting,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload test.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
