import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptHistoryRecord } from "../domain/contracts";
import { installFakeIndexedDB } from "../test/fakeIndexedDB";
import {
  clearAttemptHistory,
  loadAttemptHistory,
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

  it("trims retained history to the latest 50 records per exercise", async () => {
    for (let index = 0; index < 55; index += 1) {
      await saveAttemptHistoryRecord(attemptRecord("major-triad", index));
    }
    await saveAttemptHistoryRecord(attemptRecord("single-note-match", 0));

    const records = await loadAttemptHistory();
    const triadRecords = records.filter((record) => record.exerciseId === "major-triad");
    expect(triadRecords).toHaveLength(50);
    expect(triadRecords.some((record) => record.id === "major-triad-0")).toBe(false);
    expect(records.filter((record) => record.exerciseId === "single-note-match")).toHaveLength(1);
  });

  it("clears all local attempt history", async () => {
    await saveAttemptHistoryRecord(attemptRecord("major-triad", 0));
    await saveAttemptHistoryRecord(attemptRecord("single-note-match", 0));

    await clearAttemptHistory();

    expect(await loadAttemptHistory()).toEqual([]);
  });

  it("filters malformed records and handles unavailable IndexedDB safely", async () => {
    await saveAttemptHistoryRecord(attemptRecord("major-triad", 0));
    await putRawRecord({ id: "bad-record", exerciseId: "not-real" });

    expect(await loadAttemptHistory()).toHaveLength(1);

    vi.stubGlobal("indexedDB", undefined);
    await expect(loadAttemptHistory()).resolves.toEqual([]);
    await expect(saveAttemptHistoryRecord(attemptRecord("major-triad", 1))).resolves.toBeUndefined();
    await expect(clearAttemptHistory()).resolves.toBeUndefined();
  });
});

function attemptRecord(exerciseId: AttemptHistoryRecord["exerciseId"], index: number): AttemptHistoryRecord {
  return {
    id: `${exerciseId}-${index}`,
    exerciseId,
    createdAt: new Date(Date.UTC(2026, 4, 13, 12, index)).toISOString(),
    rootMidi: 57,
    tempoBpm: 80,
    toleranceCents: 35,
    passed: index % 2 === 0,
    summary: index % 2 === 0 ? "Nice triad." : "A3 was flat.",
    durationMs: 2400,
    notes: [
      {
        degree: 1,
        label: "A3",
        midi: 57,
        status: index % 2 === 0 ? "pass" : "flat",
        medianCents: index % 2 === 0 ? 0 : -42,
        warnings: []
      }
    ]
  };
}

async function putRawRecord(record: unknown) {
  const database = await openDatabase();
  await requestToPromise(database.transaction("attempts", "readwrite").objectStore("attempts").put(record));
  database.close();
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("pitch-coach-attempt-history", 1);
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
