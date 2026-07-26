import TodoItem from './TodoItem'

function TodoList({ todos, onDelete }) {
  if (todos.length === 0) {
    return <p className="empty-message">No todos yet! Add one above.</p>
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem key={todo.id} id={todo.id} text={todo.text} onDelete={onDelete} />
      ))}
    </ul>
  )
}

export default TodoList
