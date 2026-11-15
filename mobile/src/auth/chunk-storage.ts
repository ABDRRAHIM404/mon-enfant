/** Serialized, crash-safe small-value storage for native keychain/keystore limits.
 * Only Auth session/verifier values belong here. Clinical data never does.
 */
export type SecureValues = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Index = {
  v: 1;
  active: "a" | "b";
  a: number;
  b: number;
  length: number;
  expires: number;
};
const MAX = 128,
  CHUNK = 300,
  LIFETIME = 30 * 86400000;
export function createChunkStorage(
  native: SecureValues,
  clock = () => Date.now(),
) {
  const queues = new Map<string, Promise<unknown>>();
  function serial<T>(key: string, work: () => Promise<T>): Promise<T> {
    const prior = queues.get(key) ?? Promise.resolve();
    const task = prior.catch(() => undefined).then(work);
    queues.set(key, task);
    void task
      .finally(() => {
        if (queues.get(key) === task) queues.delete(key);
      })
      .catch(() => undefined);
    return task;
  }
  function validateKey(key: string) {
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(key))
      throw new Error("Invalid secure storage key");
  }
  async function index(key: string): Promise<Index | null> {
    const raw = await native.getItem(key + ".index");
    if (!raw) return null;
    const invalid: Index = {
      v: 1,
      active: "a",
      a: MAX,
      b: MAX,
      length: 0,
      expires: 0,
    };
    try {
      const m = JSON.parse(raw);
      if (
        m.v !== 1 ||
        !["a", "b"].includes(m.active) ||
        !Number.isInteger(m.a) ||
        !Number.isInteger(m.b) ||
        m.a < 0 ||
        m.a > MAX ||
        m.b < 0 ||
        m.b > MAX ||
        !Number.isInteger(m.length) ||
        m.length < 0 ||
        m.length > m[m.active] ||
        !Number.isFinite(m.expires)
      )
        return invalid;
      return m;
    } catch {
      return invalid;
    }
  }
  async function clear(key: string, m: Index | null) {
    if (m)
      for (const slot of ["a", "b"] as const)
        for (let i = 0; i < m[slot]; i++)
          await native.removeItem(`${key}.${slot}.${i}`);
    await native.removeItem(key + ".index");
  }
  return {
    getItem(key: string) {
      validateKey(key);
      return serial(key, async () => {
        const m = await index(key);
        if (!m) return null;
        if (m.expires <= clock()) {
          await clear(key, m);
          return null;
        }
        const values: string[] = [];
        for (let i = 0; i < m.length; i++) {
          const value = await native.getItem(`${key}.${m.active}.${i}`);
          if (value === null) {
            await clear(key, m);
            return null;
          }
          values.push(value);
        }
        return values.length ? values.join("") : null;
      });
    },
    setItem(key: string, value: string) {
      validateKey(key);
      return serial(key, async () => {
        const points = Array.from(value);
        const count = Math.ceil(points.length / CHUNK);
        if (!count || count > MAX)
          throw new Error("Secure session exceeds storage capacity");
        let m = await index(key);
        if (m && m.expires <= clock()) {
          await clear(key, m);
          m = null;
        }
        m ??= {
          v: 1,
          active: "a",
          a: 0,
          b: 0,
          length: 0,
          expires: clock() + LIFETIME,
        };
        const target = m.active === "a" ? "b" : "a";
        const previousCount = m[target];
        // Record the inactive slot's cleanup bound before writing any chunks. Readers still see the old complete active slot after interruption.
        m = { ...m, [target]: Math.max(previousCount, count) };
        await native.setItem(key + ".index", JSON.stringify(m));
        for (let i = 0; i < count; i++)
          await native.setItem(
            `${key}.${target}.${i}`,
            points.slice(i * CHUNK, (i + 1) * CHUNK).join(""),
          );
        // The single small index write commits the complete new session atomically.
        const committed: Index = { ...m, active: target, length: count };
        await native.setItem(key + ".index", JSON.stringify(committed));
        // Retain the known cleanup bounds until every obsolete chunk has gone.
        try {
          const old = target === "a" ? "b" : "a";
          for (let i = 0; i < committed[old]; i++)
            await native.removeItem(`${key}.${old}.${i}`);
          for (let i = count; i < previousCount; i++)
            await native.removeItem(`${key}.${target}.${i}`);
          await native.setItem(
            key + ".index",
            JSON.stringify({ ...committed, [old]: 0, [target]: count }),
          );
        } catch {
          /* An encrypted obsolete slot is retained for the next write/removal, never returned to readers. */
        }
      });
    },
    removeItem(key: string) {
      validateKey(key);
      return serial(key, async () => clear(key, await index(key)));
    },
  };
}
