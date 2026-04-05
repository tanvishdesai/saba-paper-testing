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
  const [hasStartedTest, setHasStartedTest] = useState(false);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});

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

  const totalQuestions = selectedTest?.questionCount ?? 0;
  const answeredCount = Object.keys(selectedOptions).length;
  const unansweredCount = Math.max(totalQuestions - answeredCount, 0);
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const score = useMemo(() => {
    if (!selectedTest) {
      return 0;
    }

    return selectedTest.questions.reduce((correctCount, question) => {
      if (selectedOptions[question.number] === question.correctOption) {
        return correctCount + 1;
      }
      return correctCount;
    }, 0);
  }, [selectedOptions, selectedTest]);

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
    setHasStartedTest(false);
    setShowFinalScore(false);
    setSelectedOptions({});
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

  function handleStartTest() {
    setHasStartedTest(true);
    setShowFinalScore(false);
    setSelectedOptions({});
    setSelectedQuestionNumber(selectedTest?.questions[0]?.number ?? 1);
  }

  function handleSelectOption(question: StoredQuestion, optionLabel: string) {
    if (!hasStartedTest || selectedOptions[question.number]) {
      return;
    }

    setSelectedOptions((previous) => ({
      ...previous,
      [question.number]: optionLabel,
    }));
  }

  function getOptionClassName(question: StoredQuestion, optionLabel: string) {
    const selectedOption = selectedOptions[question.number];
    if (!selectedOption) {
      return styles.option;
    }

    if (optionLabel === question.correctOption) {
      return `${styles.option} ${styles.optionCorrect}`;
    }

    if (optionLabel === selectedOption) {
      return `${styles.option} ${styles.optionWrong}`;
    }

    return styles.option;
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.badge}>Assessment Lab</p>
          <h1>Parse PDFs. Launch practice tests. Review score instantly.</h1>
          <p>
            A cleaner workflow for your test environment: upload question + answer-key PDFs and
            run bilingual (English/Hindi) attempts with one click.
          </p>
        </div>
        <div className={styles.heroStats}>
          <article>
            <span>Stored tests</span>
            <strong>{tests.length}</strong>
          </article>
          <article>
            <span>Active bank</span>
            <strong>{selectedTest?.title ?? "Not selected"}</strong>
          </article>
          <article>
            <span>Attempt mode</span>
            <strong>{hasStartedTest ? "Live" : "Idle"}</strong>
          </article>
        </div>
      </section>

      <section className={styles.workspaceGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2>1) Upload & Parse</h2>
            <p>Bring in a question PDF and answer-key PDF pair.</p>
          </header>
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
          <header className={styles.panelHeader}>
            <h2>2) Test Library</h2>
            <p>Select a saved test to begin or preview.</p>
          </header>
          <div className={styles.testsList}>
            {tests.length === 0 ? (
              <p className={styles.emptyState}>No tests yet.</p>
            ) : (
              tests.map((test) => (
                <button
                  className={
                    selectedTest?._id === test._id
                      ? `${styles.testCard} ${styles.testCardActive}`
                      : styles.testCard
                  }
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
        <header className={styles.panelHeader}>
          <h2>3) Attempt & Evaluate</h2>
          <p>Preview questions, run full attempts, and review performance.</p>
        </header>

        {!currentQuestion || !selectedTest ? (
          <p className={styles.emptyState}>Select a test to preview questions and correct answers.</p>
        ) : (
          <>
            <div className={styles.metricsRow}>
              <article>
                <span>Total</span>
                <strong>{totalQuestions}</strong>
              </article>
              <article>
                <span>Answered</span>
                <strong>{answeredCount}</strong>
              </article>
              <article>
                <span>Unanswered</span>
                <strong>{unansweredCount}</strong>
              </article>
              <article>
                <span>Language</span>
                <strong>{selectedLanguage === "en" ? "English" : "Hindi"}</strong>
              </article>
            </div>

            <div className={styles.progressBlock}>
              <div>
                <p>{selectedTest.title}</p>
                <span>
                  {hasStartedTest
                    ? `Progress ${answeredCount}/${totalQuestions}`
                    : "Start test to begin tracking progress"}
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className={styles.testActions}>
              <button className={styles.startButton} onClick={handleStartTest} type="button">
                {hasStartedTest ? "Restart Test" : "Start Test"}
              </button>
              <button
                className={styles.finishButton}
                disabled={!hasStartedTest || answeredCount < totalQuestions}
                onClick={() => setShowFinalScore(true)}
                type="button"
              >
                Finish Test
              </button>
            </div>
            {showFinalScore && (
              <p className={styles.scoreLine}>
                Score: {score}/{totalQuestions}
              </p>
            )}

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
                  <li className={getOptionClassName(currentQuestion, option.label)} key={option.label}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    <button
                      className={styles.optionButton}
                      disabled={!hasStartedTest || Boolean(selectedOptions[currentQuestion.number])}
                      onClick={() => handleSelectOption(currentQuestion, option.label)}
                      type="button"
                    >
                      {option.text}
                    </button>
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
