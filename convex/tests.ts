import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { type GenericId, v } from "convex/values";

const optionValidator = v.object({
  label: v.string(),
  text: v.string(),
});

const questionValidator = v.object({
  number: v.number(),
  textEn: v.optional(v.string()),
  textHi: v.optional(v.string()),
  optionsEn: v.optional(v.array(optionValidator)),
  optionsHi: v.optional(v.array(optionValidator)),
  // Backward-compatible aliases for older payloads.
  text: v.optional(v.string()),
  options: v.optional(v.array(optionValidator)),
  correctOption: v.string(),
});

export const listTests = query({
  args: {},
  handler: async (ctx) => {
    const tests = await ctx.db
      .query("tests")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    return tests.map((test) => ({
      _id: test._id,
      slug: test.slug,
      title: test.title,
      sourceQuestionFileName: test.sourceQuestionFileName,
      sourceAnswerFileName: test.sourceAnswerFileName,
      questionCount: test.questionCount,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
    }));
  },
});

export const getTestBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.query("tests").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
  },
});

export const getTestById = query({
  args: { testId: v.id("tests") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) {
      return null;
    }

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_test_number", (q) => q.eq("testId", args.testId))
      .collect();

    const normalizedQuestions = questions.map((question) => {
      const legacy = question as unknown as {
        text?: string;
        options?: Array<{ label: string; text: string }>;
      };

      return {
        ...question,
        textEn: question.textEn ?? legacy.text ?? "",
        textHi: question.textHi ?? legacy.text ?? "",
        optionsEn: question.optionsEn ?? legacy.options ?? [],
        optionsHi: question.optionsHi ?? legacy.options ?? [],
      };
    });

    return {
      _id: test._id,
      slug: test.slug,
      title: test.title,
      sourceQuestionFileName: test.sourceQuestionFileName,
      sourceAnswerFileName: test.sourceAnswerFileName,
      questionCount: test.questionCount,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      questions: normalizedQuestions,
    };
  },
});

export const upsertParsedTest = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    sourceQuestionFileName: v.optional(v.string()),
    sourceAnswerFileName: v.optional(v.string()),
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedQuestions = [...args.questions]
      .map((question) => {
        const textEn = question.textEn ?? question.text ?? "";
        const optionsEn = question.optionsEn ?? question.options ?? [];
        const textHi = question.textHi ?? textEn;
        const optionsHi = question.optionsHi ?? optionsEn;

        if (!textEn || optionsEn.length < 4) {
          throw new Error(
            `Invalid question payload for number ${question.number}: missing English text/options.`,
          );
        }

        const finalTextHi = textHi || textEn;
        const finalOptionsHi = optionsHi.length >= 4 ? optionsHi : optionsEn;

        return {
          number: question.number,
          textEn,
          textHi: finalTextHi,
          optionsEn,
          optionsHi: finalOptionsHi,
          correctOption: question.correctOption,
        };
      })
      .sort((a, b) => a.number - b.number);
    const existing = await ctx.db
      .query("tests")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    let testId: GenericId<"tests">;

    if (existing) {
      testId = existing._id;
      const existingQuestions = await ctx.db
        .query("questions")
        .withIndex("by_test", (q) => q.eq("testId", existing._id))
        .collect();

      for (const question of existingQuestions) {
        await ctx.db.delete(question._id);
      }

      await ctx.db.patch(existing._id, {
        title: args.title,
        sourceQuestionFileName: args.sourceQuestionFileName,
        sourceAnswerFileName: args.sourceAnswerFileName,
        questionCount: normalizedQuestions.length,
        updatedAt: now,
      });
    } else {
      testId = await ctx.db.insert("tests", {
        slug: args.slug,
        title: args.title,
        sourceQuestionFileName: args.sourceQuestionFileName,
        sourceAnswerFileName: args.sourceAnswerFileName,
        questionCount: normalizedQuestions.length,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const question of normalizedQuestions) {
      await ctx.db.insert("questions", {
        testId,
        number: question.number,
        textEn: question.textEn,
        textHi: question.textHi,
        optionsEn: question.optionsEn,
        optionsHi: question.optionsHi,
        correctOption: question.correctOption,
      });
    }

    return {
      testId,
      questionCount: normalizedQuestions.length,
      replacedExisting: Boolean(existing),
    };
  },
});
