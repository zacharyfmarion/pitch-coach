import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptHistoryRecord, PracticeSessionRecord } from "../domain/contracts";
import { installFakeIndexedDB } from "../test/fakeIndexedDB";
import {
  clearAttemptHistory,
  loadAttemptHistory,
  loadPracticeSessions,
  savePracticeSessionRecord,
  saveAttemptHistoryRecord
} from "./attemptHistoryStorage";

describe("attempt history storage", () => {
  beforeEach(() => {
    installFakeIndexedDB();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and loads compact attempt records", async () => {
    const record = attemptRecord("major-triad", 0);

    await saveAttemptHistoryRecord(record);

    expect(await loadAttemptHistory()).toEqual([record]);
  });

  it("saves and loads practice session records", async () => {
    const session = sessionRecord("major-triad-session-0", "major-triad", 0);

    await savePracticeSessionRecord(session);

    expect(await loadPracticeSessions()).toEqual([session]);
  });

  it("trims retained history to the latest 50 records per exercise", async () => {
    for (let index = 0; index < 55; index += 1) {
      const session = sessionRecord(`major-triad-session-${index}`, "major-triad", index);
      await savePracticeSessionRecord(session);
      await saveAttemptHistoryRecord(attemptRecord("major-triad", index, session.id));
    }
    const singleNoteSession = sessionRecord("single-note-match-session-0", "single-note-match", 0);
    await savePracticeSessionRecord(singleNoteSession);
    await saveAttemptHistoryRecord(attemptRecord("single-note-match", 0, singleNoteSession.id));

    const records = await loadAttemptHistory();
    const triadRecords = records.filter((record) => record.exerciseId === "major-triad");
    expect(triadRecords).toHaveLength(50);
    expect(triadRecords.some((record) => record.id === "major-triad-0")).toBe(false);
    expect(records.filter((record) => record.exerciseId === "single-note-match")).toHaveLength(1);
    expect((await loadPracticeSessions()).some((session) => session.id === "major-triad-session-0")).toBe(false);
  });

  it("clears all local attempt history", async () => {
    const triadSession = sessionRecord("major-triad-session-0", "major-triad", 0);
    const singleNoteSession = sessionRecord("single-note-match-session-0", "single-note-match", 0);
    await savePracticeSessionRecord(triadSession);
    await saveAttemptHistoryRecord(attemptRecord("major-triad", 0, triadSession.id));
    await savePracticeSessionRecord(singleNoteSession);
    await saveAttemptHistoryRecord(attemptRecord("single-note-match", 0, singleNoteSession.id));

    await clearAttemptHistory();

    expect(await loadAttemptHistory()).toEqual([]);
    expect(await loadPracticeSessions()).toEqual([]);
  });

  it("filters malformed records and handles unavailable IndexedDB safely", async () => {
    await saveAttemptHistoryRecord(attemptRecord("major-triad", 0));
    await putRawRecord({ id: "bad-record", exerciseId: "not-real" });
    await putRawRecord({ ...attemptRecord("major-triad", 1), id: "legacy-record", sessionId: undefined });

    expect(await loadAttemptHistory()).toHaveLength(1);

    vi.stubGlobal("indexedDB", undefined);
    await expect(loadAttemptHistory()).resolves.toEqual([]);
    await expect(loadPracticeSessions()).resolves.toEqual([]);
    await expect(saveAttemptHistoryRecord(attemptRecord("major-triad", 1))).resolves.toBeUndefined();
    await expect(savePracticeSessionRecord(sessionRecord("major-triad-session-1", "major-triad", 1))).resolves.toBeUndefined();
    await expect(clearAttemptHistory()).resolves.toBeUndefined();
  });
});

function attemptRecord(
  exerciseId: AttemptHistoryRecord["exerciseId"],
  index: number,
  sessionId = `${exerciseId}-session-${index}`
): AttemptHistoryRecord {
  return {
    id: `${exerciseId}-${index}`,
    sessionId,
    exerciseId,
    createdAt: new Date(Date.UTC(2026, 4, 13, 12, index)).toISOString(),
    rootMidi: 57,
    tempoBpm: 80,
    toleranceCents: 35,
    passed: index % 2 === 0,
    summary: index % 2 === 0 ? "Nice triad." : "A3 was flat.",
    durationMs: 2400,
    segments: [
      {
        id: "root",
        kind: "note",
        label: "Root",
        shortLabel: "R",
        noteName: "A3",
        midi: 57,
        offsetSemitones: 0,
        status: index % 2 === 0 ? "pass" : "flat",
        medianCents: index % 2 === 0 ? 0 : -42,
        warnings: []
      }
    ]
  };
}

function sessionRecord(
  id: string,
  exerciseId: PracticeSessionRecord["exerciseId"],
  index: number
): PracticeSessionRecord {
  const timestamp = new Date(Date.UTC(2026, 4, 13, 12, index)).toISOString();
  return {
    id,
    exerciseId,
    startedAt: timestamp,
    lastAttemptAt: timestamp
  };
}

async function putRawRecord(record: unknown) {
  const database = await openDatabase();
  await requestToPromise(database.transaction("attempts", "readwrite").objectStore("attempts").put(record));
  database.close();
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("pitch-coach-attempt-history", 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
