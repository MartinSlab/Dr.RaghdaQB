const { MongoClient } = require('mongodb');

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'physics-quiz';

async function main() {
  if (!uri) {
    throw new Error('MONGODB_URI is missing');
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const store = db.collection('store');

    const settingsDoc = { _id: 'settings', value: { timerMinutes: 15, allBanksCount: 10 }, updatedAt: Date.now() };
    await store.updateOne({ _id: settingsDoc._id }, { $set: settingsDoc }, { upsert: true });

    const banksDoc = await store.findOne({ _id: 'banks' });
    const banksMap = banksDoc?.value || {};

    const sampleBanks = [
      {
        id: 'mechanics-fundamentals',
        name: 'Mechanics Fundamentals',
        questions: [
          {
            text: 'What is the acceleration of an object in free fall near Earth if air resistance is ignored?',
            options: ['9.8 m/s² downward', '9.8 m/s² upward', '1.6 m/s² downward', '0 m/s²'],
            answer: 0,
            explanation: 'Near Earth, objects in free fall accelerate at about 9.8 m/s² toward the ground.',
          },
          {
            text: 'Which quantity is measured in newtons?',
            options: ['Mass', 'Force', 'Energy', 'Velocity'],
            answer: 1,
            explanation: 'Force is measured in newtons, which is the SI unit of force.',
          },
          {
            text: 'If a car moves at constant velocity, what can be said about its acceleration?',
            options: ['It is constant and non-zero', 'It is zero', 'It depends on the fuel', 'It increases with time'],
            answer: 1,
            explanation: 'Constant velocity means zero acceleration because velocity is not changing.',
          },
        ],
      },
      {
        id: 'electricity-circuits',
        name: 'Electricity & Circuits',
        questions: [
          {
            text: 'What is the SI unit of electric current?',
            options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
            answer: 1,
            explanation: 'Electric current is measured in amperes (A).',
          },
          {
            text: 'Which formula gives Ohm\'s law?',
            options: ['V = I / R', 'V = I × R', 'I = V × R', 'R = I / V'],
            answer: 1,
            explanation: 'Ohm\'s law states that voltage equals current multiplied by resistance: V = I × R.',
          },
          {
            text: 'In a series circuit, what happens to the total resistance when more resistors are added?',
            options: ['It decreases', 'It stays the same', 'It increases', 'It becomes zero'],
            answer: 2,
            explanation: 'In a series circuit, resistances add together, so total resistance increases.',
          },
        ],
      },
      {
        id: 'light-optics',
        name: 'Light & Optics',
        questions: [
          {
            text: 'When light passes from air into glass, what changes?',
            options: ['Its speed decreases', 'Its speed increases', 'Its frequency increases', 'Its color changes'],
            answer: 0,
            explanation: 'Light slows down when entering a denser medium like glass.',
          },
          {
            text: 'What type of mirror forms an upright, virtual image that is smaller than the object?',
            options: ['Concave mirror', 'Convex mirror', 'Plane mirror', 'None'],
            answer: 1,
            explanation: 'A convex mirror produces a smaller upright virtual image.',
          },
          {
            text: 'Which color has the shortest wavelength in visible light?',
            options: ['Red', 'Green', 'Blue', 'Yellow'],
            answer: 2,
            explanation: 'Violet/blue light has the shortest wavelength in the visible spectrum.',
          },
        ],
      },
    ];

    const nextBanks = {};
    for (const bank of sampleBanks) {
      const id = bank.id;
      const createdAt = Date.now() - bank.name.length * 1000;

      nextBanks[id] = {
        id,
        name: bank.name,
        count: bank.questions.length,
        createdAt,
      };

      await store.updateOne(
        { _id: 'bank:' + id },
        { $set: { _id: 'bank:' + id, value: bank.questions, updatedAt: Date.now() } },
        { upsert: true }
      );
    }

    await store.updateOne(
      { _id: 'banks' },
      { $set: { _id: 'banks', value: { ...banksMap, ...nextBanks }, updatedAt: Date.now() } },
      { upsert: true }
    );

    await store.updateOne({ _id: 'results' }, { $set: { _id: 'results', value: {}, updatedAt: Date.now() } }, { upsert: true });

    console.log('MongoDB seeded successfully in database:', dbName);
    console.log('Sample banks created:', Object.keys(nextBanks).length);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
