"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "@/components/TestStudio.module.css";
import type { StoredQuestion, StoredTestDetail, StoredTestSummary } from "@/lib/types";

type Language = "en" | "hi";

interface TestsListResponse {
  tests: StoredTestSummary[];
  error?: string;
}

interface TestDetailResponse {
  test: StoredTestDetail;
  error?: string;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function getQuestionText(question: StoredQuestion, language: Language): string {
  if (language === "hi") {
    return question.textHi || question.textEn;
  }
  return question.textEn;
}

function getQuestionOptions(question: StoredQuestion, language: Language) {
  if (language === "hi" && question.optionsHi.length >= 4) {
    return question.optionsHi;
  }
  return question.optionsEn;
}

export function TestStudio() {
  const [tests, setTests] = useState<StoredTestSummary[]>([]);
  const [selectedTest, setSelectedTest] = useState<StoredTestDetail | null>(null);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<number>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentQuestion = useMemo(() => {
    if (!selectedTest) {
      return null;
    }
    return (
      selectedTest.questions.find((question) => question.number === selectedQuestionNumber) ??
      selectedTest.questions[0] ??
      null
    );
  }, [selectedQuestionNumber, selectedTest]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload as T;
  }

  async function loadTestById(testId: string) {
    const response = await fetchJson<TestDetailResponse>(`/api/tests/${testId}`);
    setSelectedTest(response.test);
    setSelectedQuestionNumber(response.test.questions[0]?.number ?? 1);
  }

  async function loadTests({ preserveSelection }: { preserveSelection: boolean }) {
    const response = await fetchJson<TestsListResponse>("/api/tests");
    setTests(response.tests);

    if (response.tests.length === 0) {
      setSelectedTest(null);
      return;
    }

    if (!preserveSelection || !selectedTest) {
      await loadTestById(response.tests[0]._id);
      return;
    }

    const stillExists = response.tests.find((test) => test._id === selectedTest._id);
    if (stillExists) {
      await loadTestById(stillExists._id);
    } else {
      await loadTestById(response.tests[0]._id);
    }
  }

  async function bootstrapAndLoad() {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage("Preparing sample bilingual test from local PDFs...");

    try {
      await fetchJson("/api/tests/bootstrap", { method: "POST" });
      await loadTests({ preserveSelection: false });
      setStatusMessage("Sample test is ready in English + Hindi. You can upload more PDF pairs.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize.";
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void bootstrapAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const questionPdf = formData.get("questionPdf");
    const answerPdf = formData.get("answerPdf");

    if (!questionPdf || !answerPdf) {
      setErrorMessage("Please upload both PDFs.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setStatusMessage("Parsing uploaded PDFs (English + Hindi) and saving to Convex...");

    try {
      const uploadResponse = await fetchJson<{
        testId: string;
        title: string;
        questionCount: number;
        replacedExisting: boolean;
      }>("/api/tests/upload", {
        method: "POST",
        body: formData,
      });

      await loadTests({ preserveSelection: true });
      await loadTestById(uploadResponse.testId);
      form.reset();

      setStatusMessage(
        `${uploadResponse.title} saved with ${uploadResponse.questionCount} bilingual questions${
          uploadResponse.replacedExisting ? " (updated existing test)." : "."
        }`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Next.js + Convex + PDF Parsing</p>
        <h1>Test Builder Studio</h1>
        <p>
          Question banks and answer keys are mapped into bilingual tests (English + Hindi), then
          stored in Convex for instant availability.
        </p>
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <h2>Upload New Test Pair</h2>
          <p className={styles.panelCopy}>
            Upload one question PDF and one answer-key PDF in the same format. The app parses,
            maps, and stores both language versions automatically.
          </p>
          <form className={styles.uploadForm} onSubmit={handleUpload}>
            <label className={styles.field}>
              <span>Test title (optional)</span>
              <input name="title" placeholder="Example: GS Test 6310" type="text" />
            </label>
            <label className={styles.field}>
              <span>Question PDF</span>
              <input accept=".pdf,application/pdf" name="questionPdf" required type="file" />
            </label>
            <label className={styles.field}>
              <span>Answer key PDF</span>
              <input accept=".pdf,application/pdf" name="answerPdf" required type="file" />
            </label>
            <button disabled={isUploading} type="submit">
              {isUploading ? "Uploading..." : "Parse and Save Test"}
            </button>
          </form>
        </article>

        <article className={styles.panel}>
          <h2>Available Tests</h2>
          <div className={styles.testsList}>
            {tests.length === 0 ? (
              <p className={styles.emptyState}>No tests yet.</p>
            ) : (
              tests.map((test) => (
                <button
                  className={styles.testCard}
                  key={test._id}
                  onClick={() => void loadTestById(test._id)}
                  type="button"
                >
                  <strong>{test.title}</strong>
                  <span>{test.questionCount} questions</span>
                  <span className={styles.dateLine}>Updated {formatDate(test.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className={styles.feedbackArea}>
        {isLoading && <p className={styles.info}>{statusMessage ?? "Loading..."}</p>}
        {!isLoading && statusMessage && <p className={styles.info}>{statusMessage}</p>}
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
      </section>

      <section className={styles.panel}>
        <h2>Question Preview</h2>
        {!currentQuestion || !selectedTest ? (
          <p className={styles.emptyState}>Select a test to preview questions and correct answers.</p>
        ) : (
          <>
            <div className={styles.questionMeta}>
              <span>
                {selectedTest.title} - {selectedTest.questionCount} questions
              </span>
              <span>Correct option shown in green</span>
            </div>
            <div className={styles.languageToggle}>
              <button
                className={
                  selectedLanguage === "en"
                    ? `${styles.languageButton} ${styles.languageButtonActive}`
                    : styles.languageButton
                }
                onClick={() => setSelectedLanguage("en")}
                type="button"
              >
                English
              </button>
              <button
                className={
                  selectedLanguage === "hi"
                    ? `${styles.languageButton} ${styles.languageButtonActive}`
                    : styles.languageButton
                }
                onClick={() => setSelectedLanguage("hi")}
                type="button"
              >
                Hindi
              </button>
            </div>
            <div className={styles.questionPicker}>
              {selectedTest.questions.map((question) => (
                <button
                  className={
                    question.number === currentQuestion.number
                      ? `${styles.questionNumber} ${styles.questionNumberActive}`
                      : styles.questionNumber
                  }
                  key={question.number}
                  onClick={() => setSelectedQuestionNumber(question.number)}
                  type="button"
                >
                  {question.number}
                </button>
              ))}
            </div>
            <article
              className={`${styles.questionCard} ${selectedLanguage === "hi" ? styles.hindiText : ""}`}
              lang={selectedLanguage === "hi" ? "hi" : "en"}
            >
              <h3>
                Q{currentQuestion.number}. {getQuestionText(currentQuestion, selectedLanguage)}
              </h3>
              <ul className={styles.optionsList}>
                {getQuestionOptions(currentQuestion, selectedLanguage).map((option) => (
                  <li
                    className={
                      option.label === currentQuestion.correctOption
                        ? `${styles.option} ${styles.optionCorrect}`
                        : styles.option
                    }
                    key={option.label}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    <span>{option.text}</span>
                  </li>
                ))}
              </ul>
            </article>
          </>
        )}
      </section>
    </main>
  );
}

