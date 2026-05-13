import type { AttemptScore, TargetNote } from "../domain/contracts";

type FeedbackListProps = {
  targetNotes: TargetNote[];
  attemptScore: AttemptScore | null;
};

export function FeedbackList({ targetNotes, attemptScore }: FeedbackListProps) {
  const notes = attemptScore?.notes ?? targetNotes.map((note) => ({ ...note, score: null }));

  return (
    <ol className="feedback-list">
      {notes.map((note, index) => (
        <li key={`${index}-${note.degree}-${note.midi}`}>
          <span className="degree-pill">{note.degree}</span>
          <span className="note-copy">
            <span className="note-name">{note.label}</span>
            {note.score ? <span className="note-detail">{note.score.instruction}</span> : null}
          </span>
          <span className={`score-badge ${note.score ? `score-${note.score.status}` : ""}`}>
            {note.score ? describeScore(note.score) : "Target"}
          </span>
        </li>
      ))}
    </ol>
  );
}

function describeScore(score: NonNullable<AttemptScore["notes"][number]["score"]>) {
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
    case "unstable":
      return "Unstable";
    case "unclear":
      return "Unclear";
    case "missed":
      return "Missed";
  }
}
