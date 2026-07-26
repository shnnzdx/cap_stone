function TodoItem({ id, text, onDelete }) {
  return (
    <li className="todo-item">
      <span>{text}</span>
      <button className="delete-btn" onClick={() => onDelete(id)}>Delete</button>
    </li>
  )
}

export default TodoItem
