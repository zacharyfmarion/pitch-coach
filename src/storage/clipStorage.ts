import type { AttemptScore, PitchFrame } from "../domain/contracts";
import type { CapturedAudioClip } from "../audio/types";

const DB_NAME = "pitch-coach-local-clips";
const STORE_NAME = "latest-attempt";
const CLIP_KEY = "latest";
const DB_VERSION = 1;

export type StoredAttemptClip = CapturedAudioClip & {
  score: AttemptScore;
  pitchFrames: PitchFrame[];
};

type StoredAttemptClipRecord = StoredAttemptClip & {
  id: typeof CLIP_KEY;
};

export async function saveLatestAttemptClip(clip: StoredAttemptClip) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openClipDatabase();
  await requestToPromise(
    database
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put({ ...clip, id: CLIP_KEY } satisfies StoredAttemptClipRecord)
  );
  database.close();
}

export async function loadLatestAttemptClip(): Promise<StoredAttemptClip | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  const database = await openClipDatabase();
  const record = await requestToPromise<StoredAttemptClipRecord | undefined>(
    database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(CLIP_KEY)
  );
  database.close();

  if (!record) {
    return null;
  }

  const { id: _id, ...clip } = record;
  return clip;
}

export async function deleteLatestAttemptClip() {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openClipDatabase();
  await requestToPromise(
    database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(CLIP_KEY)
  );
  database.close();
}

function openClipDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
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
