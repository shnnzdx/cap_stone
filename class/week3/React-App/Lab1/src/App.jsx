import './App.css'
import TodoList from './TodoList'

function App() {
  const todos = [
    { id: 1, text: 'Learn about components' },
    { id: 2, text: 'Understand JSX' },
    { id: 3, text: 'Pass props to components' },
  ]

  return (
    <div className="app">
      <h1>My Todo App</h1>
      <TodoList todos={todos} />
    </div>
  )
}

export default App