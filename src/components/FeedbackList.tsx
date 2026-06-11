import type { AttemptScore, TargetSegment } from "../domain/contracts";

type FeedbackListProps = {
  targetSegments: TargetSegment[];
  attemptScore: AttemptScore | null;
};

export function FeedbackList({ targetSegments, attemptScore }: FeedbackListProps) {
  const segments = attemptScore?.segments ?? targetSegments.map((segment) => ({ ...segment, score: null }));

  return (
    <ol className="feedback-list">
      {segments.map((segment, index) => (
        <li key={`${index}-${segment.id}`}>
          <span className="segment-pill">{segment.shortLabel}</span>
          <span className="target-copy">
            <span className="target-name">{describeSegment(segment)}</span>
            {segment.score ? <span className="target-detail">{segment.score.instruction}</span> : null}
          </span>
          <span className={`score-badge ${segment.score ? `score-${segment.score.status}` : ""}`}>
            {segment.score ? describeScore(segment.score) : "Target"}
          </span>
        </li>
      ))}
    </ol>
  );
}

function describeSegment(segment: TargetSegment) {
  return segment.kind === "note"
    ? segment.noteName
    : `${segment.fromNoteName} → ${segment.toNoteName}`;
}

function describeScore(score: NonNullable<AttemptScore["segments"][number]["score"]>) {
  switch (score.status) {
    case "pass":
      return `Pass ${Math.round(score.medianCents ?? 0)}c`;
    case "passWithWarning":
      return `Pass ${Math.round(score.medianCents ?? 0)}c`;
    case "flat":
      return `${Math.abs(Math.round(score.medianCents ?? 0))}c flat`;
    case "sharp":
      return `${Math.round(score.medianCents ?? 0)}c sharp`;
    case "wrongNote":
      return "Wrong note";
    case "wrongDirection":
      return "Wrong way";
    case "offContour":
      return "Off line";
    case "unstable":
      return "Unstable";
    case "unclear":
      return "Unclear";
    case "missed":
      return "Missed";
  }
}
