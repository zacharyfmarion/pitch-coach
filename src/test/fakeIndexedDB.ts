import { vi } from "vitest";

type FakeDatabaseData = {
  version: number;
  stores: Map<string, Map<IDBValidKey, unknown>>;
};

export function installFakeIndexedDB() {
  const databases = new Map<string, FakeDatabaseData>();

  vi.stubGlobal("indexedDB", {
    open(name: string, version?: number) {
      const request = new FakeOpenRequest();
      queueMicrotask(() => {
        let database = databases.get(name);
        const isNewDatabase = !database;
        if (!database) {
          database = {
            version: version ?? 1,
            stores: new Map()
          };
          databases.set(name, database);
        }

        request.result = new FakeDatabase(database) as unknown as IDBDatabase;
        if (isNewDatabase || (version !== undefined && version > database.version)) {
          database.version = version ?? database.version;
          request.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
        }
        request.onsuccess?.(new Event("success"));
      });
      return request as unknown as IDBOpenDBRequest;
    }
  });
}

class FakeOpenRequest {
  result: IDBDatabase | null = null;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
}

class FakeRequest<T> {
  result: T | undefined;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(result: T) {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.(new Event("success")));
  }
}

class FakeDatabase {
  constructor(private readonly data: FakeDatabaseData) {}

  get objectStoreNames() {
    return {
      contains: (name: string) => this.data.stores.has(name)
    };
  }

  createObjectStore(name: string) {
    if (!this.data.stores.has(name)) {
      this.data.stores.set(name, new Map());
    }
    return new FakeObjectStore(this.data.stores.get(name)!);
  }

  transaction(storeName: string) {
    if (!this.data.stores.has(storeName)) {
      this.data.stores.set(storeName, new Map());
    }
    return {
      objectStore: () => new FakeObjectStore(this.data.stores.get(storeName)!)
    };
  }

  close() {}
}

class FakeObjectStore {
  constructor(private readonly records: Map<IDBValidKey, unknown>) {}

  put(value: unknown) {
    const record = value as { id?: IDBValidKey };
    if (record.id === undefined) {
      throw new Error("Fake IndexedDB records require an id key.");
    }
    this.records.set(record.id, structuredClone(value));
    return new FakeRequest(record.id) as unknown as IDBRequest<IDBValidKey>;
  }

  get(key: IDBValidKey) {
    return new FakeRequest(structuredClone(this.records.get(key))) as unknown as IDBRequest<unknown>;
  }

  getAll() {
    return new FakeRequest(
      [...this.records.values()].map((record) => structuredClone(record))
    ) as unknown as IDBRequest<unknown[]>;
  }

  delete(key: IDBValidKey) {
    this.records.delete(key);
    return new FakeRequest(undefined) as unknown as IDBRequest<undefined>;
  }

  clear() {
    this.records.clear();
    return new FakeRequest(undefined) as unknown as IDBRequest<undefined>;
  }
}
