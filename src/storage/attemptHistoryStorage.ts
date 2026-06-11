import type {
  AttemptHistoryRecord,
  SegmentAssessmentStatus,
  PracticeSessionRecord
} from "../domain/contracts";
import { isExerciseId } from "../domain/exercise";
import {
  ATTEMPT_HISTORY_LIMIT_PER_EXERCISE,
  pruneAttemptHistory
} from "../domain/progress";

const DB_NAME = "pitch-coach-attempt-history";
const STORE_NAME = "attempts";
const SESSION_STORE_NAME = "sessions";
const DB_VERSION = 2;

const SEGMENT_STATUSES = new Set<SegmentAssessmentStatus>([
  "pass",
  "passWithWarning",
  "flat",
  "sharp",
  "wrongNote",
  "wrongDirection",
  "offContour",
  "unstable",
  "unclear",
  "missed"
]);

export async function loadAttemptHistory(): Promise<AttemptHistoryRecord[]> {
  if (typeof indexedDB === "undefined") {
    return [];
  }

  try {
    const database = await openAttemptHistoryDatabase();
    const records = await requestToPromise<unknown[]>(
      database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
    );
    database.close();

    return records
      .filter(isAttemptHistoryRecord)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

export async function loadPracticeSessions(): Promise<PracticeSessionRecord[]> {
  if (typeof indexedDB === "undefined") {
    return [];
  }

  try {
    const database = await openAttemptHistoryDatabase();
    const records = await requestToPromise<unknown[]>(
      database.transaction(SESSION_STORE_NAME, "readonly").objectStore(SESSION_STORE_NAME).getAll()
    );
    database.close();

    return records
      .filter(isPracticeSessionRecord)
      .sort((a, b) => Date.parse(b.lastAttemptAt) - Date.parse(a.lastAttemptAt));
  } catch {
    return [];
  }
}

export async function saveAttemptHistoryRecord(record: AttemptHistoryRecord) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  try {
    const database = await openAttemptHistoryDatabase();
    await requestToPromise(
      database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record)
    );

    const records = await requestToPromise<unknown[]>(
      database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
    );
    const retainedRecords = pruneAttemptHistory(
      records.filter(isAttemptHistoryRecord),
      ATTEMPT_HISTORY_LIMIT_PER_EXERCISE
    );
    const retainedIds = new Set(
      retainedRecords.map((candidate) => candidate.id)
    );
    const staleIds = records
      .filter(isAttemptHistoryRecord)
      .filter((candidate) => candidate.exerciseId === record.exerciseId && !retainedIds.has(candidate.id))
      .map((candidate) => candidate.id);

    await Promise.all(
      staleIds.map((id) =>
        requestToPromise(
          database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id)
        )
      )
    );
    await prunePracticeSessions(database, retainedRecords);
    database.close();
  } catch {
    return;
  }
}

export async function savePracticeSessionRecord(record: PracticeSessionRecord) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  try {
    const database = await openAttemptHistoryDatabase();
    await requestToPromise(
      database.transaction(SESSION_STORE_NAME, "readwrite").objectStore(SESSION_STORE_NAME).put(record)
    );
    database.close();
  } catch {
    return;
  }
}

export async function clearAttemptHistory() {
  if (typeof indexedDB === "undefined") {
    return;
  }

  try {
    const database = await openAttemptHistoryDatabase();
    await requestToPromise(
      database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear()
    );
    await requestToPromise(
      database.transaction(SESSION_STORE_NAME, "readwrite").objectStore(SESSION_STORE_NAME).clear()
    );
    database.close();
  } catch {
    return;
  }
}

function openAttemptHistoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else if (event.oldVersion < 2) {
        request.transaction?.objectStore(STORE_NAME).clear();
      }
      if (!request.result.objectStoreNames.contains(SESSION_STORE_NAME)) {
        request.result.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function prunePracticeSessions(
  database: IDBDatabase,
  retainedAttempts: AttemptHistoryRecord[]
) {
  const retainedSessionIds = new Set(retainedAttempts.map((record) => record.sessionId));
  const sessions = await requestToPromise<unknown[]>(
    database.transaction(SESSION_STORE_NAME, "readonly").objectStore(SESSION_STORE_NAME).getAll()
  );
  const staleSessionIds = sessions
    .filter(isPracticeSessionRecord)
    .filter((session) => !retainedSessionIds.has(session.id))
    .map((session) => session.id);

  await Promise.all(
    staleSessionIds.map((id) =>
      requestToPromise(
        database.transaction(SESSION_STORE_NAME, "readwrite").objectStore(SESSION_STORE_NAME).delete(id)
      )
    )
  );
}

function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isAttemptHistoryRecord(value: unknown): value is AttemptHistoryRecord {
  if (!isObject(value)) {
    return false;
  }

  const record = value as Partial<AttemptHistoryRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.sessionId === "string" &&
    isExerciseId(record.exerciseId) &&
    typeof record.createdAt === "string" &&
    Number.isFinite(record.rootMidi) &&
    Number.isFinite(record.tempoBpm) &&
    Number.isFinite(record.toleranceCents) &&
    typeof record.passed === "boolean" &&
    typeof record.summary === "string" &&
    Number.isFinite(record.durationMs) &&
    Array.isArray(record.segments) &&
    record.segments.every(isAttemptHistorySegment)
  );
}

function isPracticeSessionRecord(value: unknown): value is PracticeSessionRecord {
  if (!isObject(value)) {
    return false;
  }

  const record = value as Partial<PracticeSessionRecord>;
  return (
    typeof record.id === "string" &&
    isExerciseId(record.exerciseId) &&
    typeof record.startedAt === "string" &&
    typeof record.lastAttemptAt === "string"
  );
}

function isAttemptHistorySegment(value: unknown) {
  if (!isObject(value)) {
    return false;
  }

  const segment = value as Partial<AttemptHistoryRecord["segments"][number]>;
  const hasNoteFields =
    segment.kind === "note" &&
    typeof segment.noteName === "string" &&
    Number.isFinite(segment.midi) &&
    Number.isFinite(segment.offsetSemitones);
  const hasGlideFields =
    segment.kind === "glide" &&
    typeof segment.fromNoteName === "string" &&
    typeof segment.toNoteName === "string" &&
    Number.isFinite(segment.fromMidi) &&
    Number.isFinite(segment.toMidi) &&
    Number.isFinite(segment.fromOffsetSemitones) &&
    Number.isFinite(segment.toOffsetSemitones);
  return (
    typeof segment.id === "string" &&
    (segment.kind === "note" || segment.kind === "glide") &&
    typeof segment.label === "string" &&
    typeof segment.shortLabel === "string" &&
    typeof segment.status === "string" &&
    SEGMENT_STATUSES.has(segment.status as SegmentAssessmentStatus) &&
    Array.isArray(segment.warnings) &&
    (hasNoteFields || hasGlideFields)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
