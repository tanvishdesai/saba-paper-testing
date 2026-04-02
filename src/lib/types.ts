import type { OptionLabel } from "@/lib/pdf/types";

export interface StoredTestSummary {
  _id: string;
  slug: string;
  title: string;
  sourceQuestionFileName?: string;
  sourceAnswerFileName?: string;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredQuestion {
  _id?: string;
  number: number;
  textEn: string;
  textHi: string;
  optionsEn: Array<{
    label: OptionLabel;
    text: string;
  }>;
  optionsHi: Array<{
    label: OptionLabel;
    text: string;
  }>;
  correctOption: OptionLabel;
}

export interface StoredTestDetail extends StoredTestSummary {
  questions: StoredQuestion[];
}
