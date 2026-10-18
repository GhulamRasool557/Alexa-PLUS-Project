// To-do list commands. Spoken forms vary a lot ("to do", "todo", "to-do", "list"),
// so the patterns accept all of them.
const { getStore } = require('../store');
const realtime = require('../realtime');

const LIST = String.raw`(?:(?:my|the) )?(?:to ?do(?:'s|s)?(?: list)?|list|tasks?)`;
const NUMBER_WORDS = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10 };

function spokenList(todos) {
  if (todos.length === 1) return todos[0].text;
  return todos.slice(0, -1).map((t) => t.text).join(', ') + ' and ' + todos.at(-1).text;
}

// "number 2", "the second one", or words from the item itself.
function findTodo(todos, spoken) {
  const n = spoken.match(/^(?:number |item |the )?(\d+|\w+)(?: one| item)?$/);
  const index = n && (Number(n[1]) || NUMBER_WORDS[n[1]]);
  if (index && todos[index - 1]) return todos[index - 1];
  const words = spoken.toLowerCase();
  return (
    todos.find((t) => t.text.toLowerCase() === words) ||
    todos.find((t) => t.text.toLowerCase().includes(words) || words.includes(t.text.toLowerCase()))
  );
}

module.exports = [
  {
    name: 'todo-read',
    match: new RegExp(String.raw`^(?:read|what's on|whats on|what is on|what are|tell me|show|check)(?: me)? ${LIST}$|^what (?:do i have to do|are my to ?dos?)$`),
    run: async () => {
      const todos = await getStore().todos.list();
      if (!todos.length) return { speech: 'Your to-do list is empty.', display: '0 TODO' };
      return {
        speech: `You have ${todos.length} ${todos.length === 1 ? 'thing' : 'things'} to do: ${spokenList(todos)}.`,
        display: `${todos.length} TODO`,
      };
    },
  },
  {
    name: 'todo-clear',
    match: new RegExp(String.raw`^(?:clear|empty|delete|erase)(?: all)?(?: of)? ${LIST}$`),
    run: async () => {
      const count = await getStore().todos.clear();
      realtime.notifyChanged('todos');
      return { speech: count ? `Cleared ${count} ${count === 1 ? 'item' : 'items'}.` : 'Your list was already empty.', display: 'DONE' };
    },
  },
  {
    name: 'todo-add',
    match: new RegExp(String.raw`^(?:add|put) (.+?) (?:to|on|in) ${LIST}$|^(?:add|new|create)(?: a)? (?:to ?do|task)(?: item)? (?:to )?(.+)$`),
    run: async ({ match }) => {
      const text = (match[1] || match[2]).trim();
      await getStore().todos.add(text);
      realtime.notifyChanged('todos');
      return { speech: `Added ${text} to your to-do list.`, display: 'ADDED' };
    },
  },
  {
    name: 'todo-done',
    match: new RegExp(String.raw`^(?:remove|delete|cross off|tick off|check off|mark|complete|finish|i finished|i did) (.+?)(?: (?:from|off|on) ${LIST})?(?: as)?(?: done| complete| completed| finished)?$`),
    run: async ({ match }) => {
      const store = getStore();
      const todo = findTodo(await store.todos.list(), match[1]);
      if (!todo) return { speech: `I couldn't find ${match[1]} on your to-do list.`, display: '?' };
      await store.todos.complete(todo.id);
      realtime.notifyChanged('todos');
      return { speech: `Done. Removed ${todo.text}.`, display: 'DONE' };
    },
  },
];

module.exports.findTodo = findTodo;
