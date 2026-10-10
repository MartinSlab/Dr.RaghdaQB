import { MongoClient } from 'mongodb';

function friendlyMongoError(e) {
  const m = String(e?.message || e);
  if (/bad auth|authentication failed|AuthenticationFailed/i.test(m))
    return 'MongoDB rejected the username or password in MONGODB_URI. Check them in Atlas → Database Access (if the password has special characters like @ : / ? # % it must be URL-encoded).';
  if (/ENOTFOUND|querySrv|EAI_AGAIN|invalid (scheme|connection string)|URI must/i.test(m))
    return 'MONGODB_URI looks wrong (cluster address not found). Copy it again from Atlas → Connect → Drivers and replace <password> with your real password.';
  if (/Could not connect to any servers|Server selection|timed out|ECONNREFUSED|ReplicaSetNoPrimary|ssl|tls/i.test(m))
    return 'Cannot reach MongoDB. In Atlas → Network Access, add 0.0.0.0/0 (Vercel uses changing IP addresses) and make sure the cluster is running.';
  return 'Database error: ' + m.replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, 'mongodb://…');
}

export async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    throw new Error('MONGODB_URI is not set. Add it to .env (local) or Vercel → Settings → Environment Variables, then redeploy.');
  }
  if (!globalThis._mongoClient) {
    const client = new MongoClient(uri.trim(), { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 });
    globalThis._mongoClient = client.connect().catch((e) => {
      globalThis._mongoClient = null; // retry on the next request
      throw new Error(friendlyMongoError(e));
    });
  }
  const client = await globalThis._mongoClient;
  return client.db(process.env.MONGODB_DB || 'physics-quiz');
}

async function getStoreCollection() {
  return (await getMongoDb()).collection('store');
}

async function readValue(key) {
  const collection = await getStoreCollection();
  const doc = await collection.findOne({ _id: key });

  if (!doc) return null;

  if (doc.expiresAt && doc.expiresAt <= Date.now()) {
    await collection.deleteOne({ _id: key });
    return null;
  }

  return doc.value;
}

export const redis = {
  async get(key) {
    return readValue(key);
  },

  async set(key, value, options = {}) {
    const collection = await getStoreCollection();
    const payload = {
      _id: key,
      value,
      updatedAt: Date.now(),
    };

    if (options && typeof options.ex === 'number' && options.ex > 0) {
      payload.expiresAt = Date.now() + options.ex * 1000;
    }

    await collection.updateOne({ _id: key }, { $set: payload }, { upsert: true });
    return value;
  },

  async del(key) {
    const collection = await getStoreCollection();
    await collection.deleteOne({ _id: key });
    return 1;
  },

  async hgetall(key) {
    const value = await readValue(key);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  },

  async hset(key, values = {}) {
    const current = (await readValue(key)) || {};
    const merged = { ...current, ...values };
    await this.set(key, merged);
    return merged;
  },

  async hdel(key, field) {
    const current = (await readValue(key)) || {};
    if (!(field in current)) return 0;

    delete current[field];
    await this.set(key, current);
    return 1;
  },
};

export async function getSettings() {
  const saved = (await redis.get('settings')) || {};
  return { timerMinutes: 0, allBanksCount: 20, ...saved };
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
