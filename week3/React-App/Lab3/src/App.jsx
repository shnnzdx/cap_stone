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

  function deleteTodo(id) {
    setTodos(todos.filter((todo) => todo.id !== id))
  }

  return (
    <div className="app">
      <h1>My Todo App</h1>
      <AddTodo onAdd={addTodo} />
      <TodoList todos={todos} onDelete={deleteTodo} />
    </div>
  )
}

export default App
