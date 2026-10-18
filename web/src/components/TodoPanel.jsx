import { useState } from 'react'
import { addTodo, completeTodo } from '../api'

export default function TodoPanel({ todos, onChange }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  async function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await addTodo(text.trim())
      setText('')
      onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  async function done(id) {
    try {
      await completeTodo(id)
      onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>To-do</h2>
        <span className="count">{todos.length}</span>
      </header>
      {todos.length === 0 ? (
        <p className="muted">Nothing to do. Say "add buy milk to my to-do list".</p>
      ) : (
        <ul className="todos">
          {todos.map((t) => (
            <li key={t.id}>
              <button className="check" onClick={() => done(t.id)} aria-label={`Mark ${t.text} done`} />
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" />
        <button>Add</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
