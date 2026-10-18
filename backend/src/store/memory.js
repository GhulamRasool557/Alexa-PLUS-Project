// In-memory store for local development and tests (data is lost on restart).
// Same interface as the MongoDB store.
const { randomUUID } = require('crypto');

function createMemoryStore() {
  let todos = [];
  let reminders = [];
  let history = [];
  let events = [];
  const screens = new Map();

  return {
    kind: 'memory',
    events: {
      add: async (event) => {
        const saved = { id: randomUUID(), ...event };
        events.push(saved);
        events = events.slice(-200);
        return saved;
      },
      since: async (date) => events.filter((e) => e.at > date),
    },
    screens: {
      seen: async (id) => {
        screens.set(id, Date.now());
      },
      countActive: async (withinMs) => [...screens.values()].filter((t) => Date.now() - t < withinMs).length,
    },
    todos: {
      list: async () => todos.filter((t) => !t.done),
      add: async (text) => {
        const todo = { id: randomUUID(), text, done: false, createdAt: new Date() };
        todos.push(todo);
        return todo;
      },
      complete: async (id) => {
        const todo = todos.find((t) => t.id === id && !t.done);
        if (todo) todo.done = true;
        return todo || null;
      },
      clear: async () => {
        const count = todos.filter((t) => !t.done).length;
        todos = todos.filter((t) => t.done);
        return count;
      },
    },
    reminders: {
      upcoming: async () => reminders.filter((r) => r.at > new Date()).sort((a, b) => a.at - b.at),
      add: async (data) => {
        const reminder = { id: randomUUID(), createdAt: new Date(), ...data };
        reminders.push(reminder);
        return reminder;
      },
    },
    history: {
      add: async (entry) => {
        history.push({ id: randomUUID(), ...entry });
        history = history.slice(-500);
      },
      recent: async (limit = 50) => history.slice(-limit),
    },
  };
}

module.exports = { createMemoryStore };
