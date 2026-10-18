// MongoDB Atlas store. Used when MONGODB_URI is set.
const mongoose = require('mongoose');

const toJSON = {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    delete ret._id;
    return ret;
  },
};

const Todo = mongoose.model(
  'Todo',
  new mongoose.Schema({ text: { type: String, required: true }, done: { type: Boolean, default: false, index: true } }, { timestamps: true, toJSON }),
);

const Reminder = mongoose.model(
  'Reminder',
  new mongoose.Schema(
    {
      kind: { type: String, enum: ['alarm', 'reminder'], required: true },
      text: String,
      at: { type: Date, index: true },
      alexaAlertToken: String,
    },
    { timestamps: true, toJSON },
  ),
);

const History = mongoose.model(
  'History',
  new mongoose.Schema(
    { text: String, source: String, command: String, speech: String, display: String, at: { type: Date, index: true } },
    { toJSON },
  ),
);

const plain = (doc) => doc && doc.toJSON();

async function createMongoStore(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB');

  return {
    kind: 'mongo',
    todos: {
      list: async () => (await Todo.find({ done: false }).sort({ createdAt: 1 })).map(plain),
      add: async (text) => plain(await Todo.create({ text })),
      complete: async (id) => {
        if (!mongoose.isValidObjectId(id)) return null;
        return plain(await Todo.findOneAndUpdate({ _id: id, done: false }, { done: true }, { new: true }));
      },
      clear: async () => (await Todo.updateMany({ done: false }, { done: true })).modifiedCount,
    },
    reminders: {
      upcoming: async () => (await Reminder.find({ at: { $gt: new Date() } }).sort({ at: 1 })).map(plain),
      add: async (data) => plain(await Reminder.create(data)),
    },
    history: {
      add: async (entry) => {
        await History.create(entry);
      },
      recent: async (limit = 50) => (await History.find().sort({ at: -1 }).limit(limit)).map(plain).reverse(),
    },
  };
}

module.exports = { createMongoStore };
