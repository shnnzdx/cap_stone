import { useState } from 'react'
import './App.css'
import AddTodo from './AddTodo'
import TodoList from './TodoList'

function App() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn about components' },
    { id: 2, text: 'Understand JSX' },
    { id: 3, text: 'Pass props to components' },
  ])

  function addTodo(text) {
    const newTodo = { id: Date.now(), text: text }
    setTodos([...todos, newTodo])
  }

  return (
    <div className="app">
      <h1>My Todo App</h1>
      <AddTodo onAdd={addTodo} />
      <TodoList todos={todos} />
    </div>
  )
}

export default App