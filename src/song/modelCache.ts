const DB_NAME = "pitch-coach-song-model-cache";
const STORE_NAME = "models";
const DB_VERSION = 1;

export type ModelDownloadProgress = {
  loadedBytes: number;
  totalBytes?: number;
};

export async function fetchModelWithCache(
  modelUrl: string,
  onProgress?: (progress: ModelDownloadProgress) => void
): Promise<ArrayBuffer> {
  const cached = await loadCachedModel(modelUrl).catch(() => null);
  if (cached) {
    onProgress?.({ loadedBytes: cached.byteLength, totalBytes: cached.byteLength });
    return cached;
  }

  const downloaded = await fetchModel(modelUrl, onProgress);
  await saveCachedModel(modelUrl, downloaded).catch(() => undefined);
  return downloaded;
}

async function fetchModel(
  modelUrl: string,
  onProgress?: (progress: ModelDownloadProgress) => void
) {
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Could not download the vocal isolation model (${response.status}).`);
  }

  const totalBytes = parseContentLength(response.headers.get("content-length"));
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress?.({ loadedBytes: buffer.byteLength, totalBytes: totalBytes ?? buffer.byteLength });
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    loadedBytes += value.byteLength;
    onProgress?.({ loadedBytes, totalBytes });
  }

  const bytes = new Uint8Array(loadedBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes.buffer;
}

async function loadCachedModel(modelUrl: string): Promise<ArrayBuffer | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  const database = await openModelDatabase();
  const record = await requestToPromise<ModelCacheRecord | undefined>(
    database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(modelUrl)
  );
  database.close();
  return record?.buffer ?? null;
}

async function saveCachedModel(modelUrl: string, buffer: ArrayBuffer) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openModelDatabase();
  await requestToPromise(
    database
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put({ modelUrl, buffer, savedAt: new Date().toISOString() } satisfies ModelCacheRecord)
  );
  database.close();
}

type ModelCacheRecord = {
  modelUrl: string;
  buffer: ArrayBuffer;
  savedAt: string;
};

function openModelDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "modelUrl" });
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

function parseContentLength(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
