const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

export default function RemindersPanel({ reminders }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Alarms and reminders</h2>
      </header>
      {reminders.length === 0 ? (
        <p className="muted">None set. Say "Alexa, ask Jarvis to set an alarm for 7 AM".</p>
      ) : (
        <ul className="reminders">
          {reminders.map((r) => (
            <li key={r.id}>
              <span className="when">{formatter.format(new Date(r.at))}</span>
              <span>{r.kind === 'alarm' ? 'Alarm' : r.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">These ring on your Echo Dot.</p>
    </section>
  )
}
