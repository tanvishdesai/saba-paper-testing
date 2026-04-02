import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tests: defineTable({
    slug: v.string(),
    title: v.string(),
    sourceQuestionFileName: v.optional(v.string()),
    sourceAnswerFileName: v.optional(v.string()),
    questionCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"]),
  questions: defineTable({
    testId: v.id("tests"),
    number: v.number(),
    textEn: v.string(),
    textHi: v.string(),
    optionsEn: v.array(
      v.object({
        label: v.string(),
        text: v.string(),
      }),
    ),
    optionsHi: v.array(
      v.object({
        label: v.string(),
        text: v.string(),
      }),
    ),
    correctOption: v.string(),
  })
    .index("by_test", ["testId"])
    .index("by_test_number", ["testId", "number"]),
});
