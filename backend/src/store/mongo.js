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

// Dashboard events (actions, results, list changes). Kept for an hour.
const Event = mongoose.model(
  'Event',
  new mongoose.Schema(
    { type: String, data: mongoose.Schema.Types.Mixed, at: { type: Date, index: { expires: 3600 } } },
    { toJSON },
  ),
);

// When each open dashboard last checked in.
const Screen = mongoose.model('Screen', new mongoose.Schema({ _id: String, seenAt: { type: Date, index: true } }));

const plain = (doc) => doc && doc.toJSON();

async function createMongoStore(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB');

  return {
    kind: 'mongo',
    events: {
      add: async (event) => plain(await Event.create(event)),
      since: async (date) => (await Event.find({ at: { $gt: date } }).sort({ at: 1 }).limit(200)).map(plain),
    },
    screens: {
      seen: async (id) => {
        await Screen.updateOne({ _id: id }, { seenAt: new Date() }, { upsert: true });
      },
      countActive: async (withinMs) => Screen.countDocuments({ seenAt: { $gt: new Date(Date.now() - withinMs) } }),
    },
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
