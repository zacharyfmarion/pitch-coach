import type { ExerciseId, ExerciseProgressSummary } from "../../domain/contracts";

type PracticeProgressSummaryProps = {
  progress: Record<ExerciseId, ExerciseProgressSummary>;
};

export function PracticeProgressSummary({ progress }: PracticeProgressSummaryProps) {
  const summaries = Object.values(progress);
  const practicedCount = summaries.filter((summary) => summary.attemptCount > 0).length;
  const attemptCount = summaries.reduce((total, summary) => total + summary.attemptCount, 0);
  const passRates = summaries
    .map((summary) => summary.recentPassRate)
    .filter((rate): rate is number => rate !== undefined);
  const averagePassRate =
    passRates.length > 0
      ? Math.round(passRates.reduce((total, rate) => total + rate, 0) / passRates.length)
      : undefined;

  return (
    <section className="library-progress" aria-label="Practice progress">
      <span className="readout-label">Progress</span>
      <div className="library-progress__stats">
        <span>
          <strong>{attemptCount}</strong>
          <span>attempts</span>
        </span>
        <span>
          <strong>{practicedCount}</strong>
          <span>drills tried</span>
        </span>
        <span>
          <strong>{averagePassRate === undefined ? "--" : `${averagePassRate}%`}</strong>
          <span>recent pass</span>
        </span>
      </div>
    </section>
  );
}
