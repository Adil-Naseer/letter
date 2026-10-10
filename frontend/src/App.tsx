import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

type Book = { id: number; title: string; status: string; error_message?: string }
type Question = {
  id: number
  type: string
  question_text: string
  options?: Record<string, string>
  correct_answer?: string
  explanation?: string
  marks: number
}

type Test = { id: number; title: string; duration_minutes: number; total_marks: number; mode: string }
type ChatMessage = { role: string; content: string }

async function api<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> || {}) }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || `Request failed: ${res.status}`)
  }
  return res.json()
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [email, setEmail] = useState('student@example.com')
  const [password, setPassword] = useState('password123')
  const [books, setBooks] = useState<Book[]>([])
  const [bookId, setBookId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [activeTest, setActiveTest] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [dashboard, setDashboard] = useState<any>(null)
  const [wrong, setWrong] = useState<Question[]>([])
  const [flashcards, setFlashcards] = useState<any[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [mode, setMode] = useState<{ label: string; demo_mode: boolean }>({ label: 'Loading...', demo_mode: true })
  const [message, setMessage] = useState('')
  const [currentView, setCurrentView] = useState('dashboard')

  const selectedBook = useMemo(() => books.find((b) => b.id === bookId), [bookId, books])

  const loadCore = async () => {
    if (!token) return
    const [bookRows, testRows, dash, wrongRows, cardRows, modeRes] = await Promise.all([
      api<Book[]>('/books', token),
      api<Test[]>('/tests', token),
      api<Record<string, any>>('/analytics/dashboard', token),
      api<Question[]>('/revision/wrong-answers', token),
      api<any[]>('/flashcards', token),
      api<{ label: string; demo_mode: boolean }>('/system/mode', token),
    ])
    setBooks(bookRows)
    setTests(testRows)
    setDashboard(dash)
    setWrong(wrongRows)
    setFlashcards(cardRows)
    setMode(modeRes)
    if (!bookId && bookRows.length) setBookId(bookRows[0].id)
  }

  useEffect(() => {
    loadCore().catch((e) => setMessage(e.message))
  }, [token])

  useEffect(() => {
    if (!token || !bookId) return
    api<Question[]>(`/questions?book_id=${bookId}&page_size=100`, token)
      .then(setQuestions)
      .catch((e) => setMessage(e.message))
    api<ChatMessage[]>('/tutor/history?book_id=' + bookId, token)
      .then(setChat)
      .catch(() => setChat([]))
  }, [token, bookId])

  const persistToken = (next: string | null) => {
    setToken(next)
    if (next) localStorage.setItem('token', next)
    else localStorage.removeItem('token')
  }

  const signup = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/auth/signup', null, { method: 'POST', body: JSON.stringify({ email, password }) })
      await login(e)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const login = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const t = await api<{ access_token: string }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      persistToken(t.access_token)
      setMessage('Logged in successfully')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const uploadBook = async (file: File) => {
    if (!token) return
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/books/upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form,
    })
    if (!res.ok) throw new Error(await res.text())
    const row = await res.json()
    setBooks((prev) => [row, ...prev])
    setBookId(row.id)
  }

  const generate = async () => {
    if (!token || !bookId) return
    await api('/questions/generate', token, {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, counts: { mcq: 10, short: 4, long: 2 } }),
    })
    const rows = await api<Question[]>(`/questions?book_id=${bookId}&page_size=100`, token)
    setQuestions(rows)
  }

  const createTest = async () => {
    if (!token || !bookId || !questions.length) return
    const ids = questions.slice(0, 10).map((q) => q.id)
    await api('/tests', token, {
      method: 'POST',
      body: JSON.stringify({
        book_id: bookId,
        title: `${selectedBook?.title || 'Book'} mixed test`,
        mode: 'exam',
        duration_minutes: 20,
        question_ids: ids,
      }),
    })
    setTests(await api('/tests', token))
  }

  const startTest = async (testId: number) => {
    if (!token) return
    const attempt = await api<{ attempt_id: number }>('/attempts/start', token, {
      method: 'POST',
      body: JSON.stringify({ test_id: testId }),
    })
    setAttemptId(attempt.attempt_id)
    const detail = await api<any>(`/tests/${testId}`, token)
    setActiveTest(detail)
  }

  const autosave = async () => {
    if (!token || !attemptId) return
    await api(`/attempts/${attemptId}/autosave`, token, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    })
  }

  const submit = async () => {
    if (!token || !attemptId) return
    const result = await api<{ score: number; max_score: number }>(`/attempts/${attemptId}/submit`, token, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    })
    setMessage(`Submitted: ${result.score}/${result.max_score}`)
    setAttemptId(null)
    setActiveTest(null)
    setAnswers({})
    await loadCore()
  }

  const askTutor = async () => {
    if (!token || !bookId || !chatInput.trim()) return
    const q = chatInput
    setChatInput('')
    setChat((prev) => [...prev, { role: 'user', content: q }])
    const res = await api<{ answer: string; references: { page: number; chapter: string }[] }>('/tutor/chat', token, {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, question: q }),
    })
    setChat((prev) => [...prev, { role: 'assistant', content: `${res.answer}\nRefs: ${res.references.map((r) => `${r.chapter} p.${r.page}`).join(', ')}` }])
  }

  if (!token) {
    return (
      <main className="container">
        <h1>Smart Study & Exam Preparation Platform</h1>
        <p className="demo">{mode.label}</p>
        <form className="card" onSubmit={login}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required />
          <div className="row">
            <button type="submit">Login</button>
            <button onClick={signup}>Sign up</button>
          </div>
          <p>{message}</p>
        </form>
      </main>
    )
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <h2>Study Platform</h2>
        <p className="demo">{mode.label}</p>
        <button onClick={() => persistToken(null)}>Logout</button>
        <ul>
          <li className={currentView === 'dashboard' ? 'active-nav' : ''} onClick={() => setCurrentView('dashboard')}>Dashboard</li>
          <li className={currentView === 'library' ? 'active-nav' : ''} onClick={() => setCurrentView('library')}>Library</li>
          <li className={currentView === 'questions' ? 'active-nav' : ''} onClick={() => setCurrentView('questions')}>Question Bank</li>
          <li className={currentView === 'tests' ? 'active-nav' : ''} onClick={() => setCurrentView('tests')}>Create & Take Test</li>
          <li className={currentView === 'revision' ? 'active-nav' : ''} onClick={() => setCurrentView('revision')}>Wrong Answers & Flashcards</li>
          <li className={currentView === 'tutor' ? 'active-nav' : ''} onClick={() => setCurrentView('tutor')}>AI Tutor</li>
        </ul>
      </aside>
      <section className="content">
        {currentView === 'dashboard' && (
          <>
            <h1>Dashboard</h1>
            {dashboard && (
              <div className="grid">
                <div className="card">Books: {dashboard.books}</div>
                <div className="card">Questions: {dashboard.questions}</div>
                <div className="card">Tests: {dashboard.tests_completed}</div>
                <div className="card">Avg: {dashboard.average_score}%</div>
              </div>
            )}
          </>
        )}

        {currentView === 'library' && (
          <section className="card">
            <h3>Library / Upload Book</h3>
          <input
            type="file"
            accept="application/pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                await uploadBook(file)
                setMessage('Upload complete; processing started.')
              } catch (err: any) {
                setMessage(err.message)
              }
            }}
          />
          <div className="scroll">
            {books.map((b) => (
              <button key={b.id} className={bookId === b.id ? 'active' : ''} onClick={() => setBookId(b.id)}>
                {b.title} — {b.status}
              </button>
            ))}
          </div>
        </section>
        )}

        {currentView === 'questions' && (
          <section className="card">
            <h3>Question Bank</h3>
          <button disabled={!bookId} onClick={generate}>Generate Chapter Questions</button>
          <p>Total: {questions.length}</p>
          <div className="scroll">
            {questions.map((q) => (
              <article key={q.id}>
                <b>{q.type.toUpperCase()}</b> ({q.marks} marks): {q.question_text}
              </article>
            ))}
          </div>
        </section>
        )}

        {currentView === 'tests' && (
          <section className="card">
            <h3>Create & Take Test</h3>
          <button disabled={!questions.length} onClick={createTest}>Create Mixed Test from Current Book</button>
          <div className="scroll">
            {tests.map((t) => (
              <button key={t.id} onClick={() => startTest(t.id)}>
                {t.title} ({t.total_marks} marks, {t.duration_minutes}m)
              </button>
            ))}
          </div>
          {activeTest && (
            <div>
              <h4>{activeTest.title}</h4>
              {activeTest.questions.map((q: any) => (
                <div key={q.id} className="card">
                  <p>{q.question_text}</p>
                  {q.options ? (
                    <div className="options">
                      {Object.entries(q.options).map(([key, value]) => (
                        <button key={key} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}>
                          {key}. {value as string}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea value={answers[q.id] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div className="row">
                <button onClick={autosave}>Autosave</button>
                <button onClick={submit}>Submit Attempt</button>
              </div>
            </div>
          )}
        </section>
        )}

        {currentView === 'revision' && (
          <section className="card">
            <h3>Wrong Answers & Flashcards</h3>
          <p>Wrong answers tracked: {wrong.length}</p>
          <button
            disabled={!bookId}
            onClick={async () => {
              if (!token || !bookId) return
              await api('/flashcards', token, {
                method: 'POST',
                body: JSON.stringify({ book_id: bookId, front: 'Key concept?', back: 'Review chunk summary.' }),
              })
              setFlashcards(await api('/flashcards', token))
            }}
          >
            Add Flashcard
          </button>
          <p>Flashcards: {flashcards.length}</p>
        </section>
        )}

        {currentView === 'tutor' && (
          <section className="card">
            <h3>Book-Grounded AI Tutor</h3>
          <div className="chat">
            {chat.map((m, idx) => (
              <p key={idx}><b>{m.role}:</b> {m.content}</p>
            ))}
          </div>
          <div className="row">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask from selected book..." />
            <button disabled={!bookId} onClick={askTutor}>Ask</button>
          </div>
        </section>
        )}

        <p className="message">{message}</p>
      </section>
    </main>
  )
}

export default App
