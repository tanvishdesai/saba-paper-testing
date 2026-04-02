export type OptionLabel = "A" | "B" | "C" | "D";

export interface ParsedOption {
  label: OptionLabel;
  text: string;
}

export interface ParsedQuestionWithoutAnswer {
  number: number;
  textEn: string;
  textHi: string;
  optionsEn: ParsedOption[];
  optionsHi: ParsedOption[];
}

export interface ParsedQuestion extends ParsedQuestionWithoutAnswer {
  correctOption: OptionLabel;
}

export interface ParsedTest {
  slug: string;
  title: string;
  sourceQuestionFileName?: string;
  sourceAnswerFileName?: string;
  questions: ParsedQuestion[];
}
