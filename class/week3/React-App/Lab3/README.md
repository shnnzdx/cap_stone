# Lab 3: Delete & Conditional Rendering

## What You Will Learn

In this lab you will finish your todo app! By the end, users will be able to **delete** todos and see a friendly message when the list is empty.

You will learn:

1. **Passing Callbacks Through Multiple Levels** — How a grandchild component can talk back to a grandparent
2. **Filtering State** — Removing an item from an array without changing the original
3. **Conditional Rendering** — Showing different things on screen based on a condition

---

## Starting Point

You should have your completed **Lab 2** project. If you don't, copy the Lab 2 solution folder and rename it `Lab3`.

Your starting files:

```
Lab3/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx        ← we will change this
    ├── AddTodo.jsx    ← stays the same
    ├── TodoList.jsx   ← we will change this
    ├── TodoItem.jsx   ← we will change this
    └── App.css        ← we will add styles
```

---

## Quick Recap from Lab 2

In Lab 2, you made the app interactive:
- `App` holds the todo list in **state** (`useState`)
- `AddTodo` lets users type and add new todos
- Data flows DOWN through props, and actions flow UP through callbacks

Now we'll add the ability to **delete** todos.

---

## Step 1: Add a `deleteTodo` Function in `App.jsx`

Open **`src/App.jsx`** and update it:

```jsx
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
```

### What's new?

| What's new | What it does |
|-----------|-------------|
| `function deleteTodo(id)` | A function that removes a todo by its `id` |
| `todos.filter((todo) => todo.id !== id)` | Creates a NEW array with every todo EXCEPT the one we want to delete |
| `onDelete={deleteTodo}` | Passes the delete function down to `TodoList` as a prop |

> **Key Concept: Filtering**  
> `filter()` creates a new array that only keeps items where the condition is `true`.  
> `todos.filter((todo) => todo.id !== id)` means: "Keep every todo whose id is NOT equal to the one I want to delete."
>
> Example: if `id` is 2, then:
> - Todo 1: `1 !== 2` → true → KEEP
> - Todo 2: `2 !== 2` → false → REMOVE
> - Todo 3: `3 !== 2` → true → KEEP

---

## Step 2: Update `TodoList.jsx` — Add Conditional Rendering

Open **`src/TodoList.jsx`** and change it to:

```jsx
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
```

### What's new?

| What's new | What it does |
|-----------|-------------|
| `{ todos, onDelete }` | Now receives BOTH the todo list AND the delete callback |
| `if (todos.length === 0)` | Checks if the list is empty |
| `return <p>...</p>` | If empty, show a message instead of the list |
| `id={todo.id}` | Now also passes the `id` to each `TodoItem` |
| `onDelete={onDelete}` | Passes the delete function through to each `TodoItem` |

> **Key Concept: Conditional Rendering**  
> Sometimes you want to show different things depending on a condition.  
> Here, if there are no todos, we show a message. Otherwise, we show the list.
>
> Common patterns for conditional rendering:
> - **`if` statement** (what we used): return early with something different
> - **Ternary:** `{condition ? <ShowThis /> : <ShowThat />}`
> - **`&&` operator:** `{condition && <ShowThis />}` (shows nothing if false)

---

## Step 3: Update `TodoItem.jsx` — Add a Delete Button

Open **`src/TodoItem.jsx`** and change it to:

```jsx
function TodoItem({ id, text, onDelete }) {
  return (
    <li className="todo-item">
      <span>{text}</span>
      <button className="delete-btn" onClick={() => onDelete(id)}>Delete</button>
    </li>
  )
}

export default TodoItem
```

### What's new?

| What's new | What it does |
|-----------|-------------|
| `{ id, text, onDelete }` | Now receives the `id` and the `onDelete` callback |
| `<span>{text}</span>` | Wraps text in a span (so we can put the button next to it) |
| `<button onClick={...}>Delete</button>` | A delete button! |
| `() => onDelete(id)` | When clicked, calls `onDelete` with THIS todo's id |

> **Key Concept: Passing Callbacks Through Multiple Levels**  
> The `deleteTodo` function lives in `App`, but the Delete button is in `TodoItem`.  
> The chain looks like this:
>
> ```
> App (defines deleteTodo)
>  └── passes onDelete to → TodoList
>                              └── passes onDelete to → TodoItem
>                                                         └── calls onDelete(id) on click
> ```
>
> This is how a deeply nested component communicates back up to its grandparent!

> **Why `() => onDelete(id)` instead of just `onDelete(id)`?**  
> If we wrote `onClick={onDelete(id)}`, it would call the function RIGHT AWAY when rendering (not on click!).  
> We wrap it in `() => ...` to say: "Don't run this yet — only run it when the button is actually clicked."

---

## Step 4: Update the Styles — `App.css`

Open **`src/App.css`** and replace it with:

```css
.app {
  max-width: 400px;
  margin: 40px auto;
  font-family: sans-serif;
}

.app h1 {
  text-align: center;
}

.add-todo {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.add-todo input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.add-todo button {
  padding: 8px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.add-todo button:hover {
  background: #45a049;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin: 6px 0;
  background: #f4f4f4;
  border-radius: 4px;
}

.delete-btn {
  padding: 4px 10px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-btn:hover {
  background: #c0392b;
}

.empty-message {
  text-align: center;
  color: #888;
  font-style: italic;
}
```

New styles:
- `.todo-item` now uses `display: flex` to put text and button side by side
- `.delete-btn` is a red button
- `.empty-message` is gray italic text for the empty state

---

## Step 5: Run Your App!

In your terminal, run:

```
npm run dev
```

Open **http://localhost:5173** and try it out:
1. Click "Delete" on a todo — it disappears!
2. Delete ALL todos — you should see "No todos yet! Add one above."
3. Add a new todo — the message goes away and your todo appears!

---

## The Complete Data Flow

```
App  (owns state: todos)
 │
 ├── passes onAdd ──→  AddTodo
 │                       └── user submits → calls onAdd(text) → App adds to state
 │
 └── passes todos + onDelete ──→  TodoList
                                      │
                                      ├── if empty → shows "No todos yet!"
                                      │
                                      └── for each todo → TodoItem
                                                            └── user clicks Delete → calls onDelete(id) → App removes from state
```

Every time state changes, React re-renders the affected components automatically!

---

## Review: What You Learned Across All 3 Labs

| Lab | Concepts |
|-----|----------|
| Lab 1 | Components, JSX, Props, Lists & Keys |
| Lab 2 | State (useState), Event Handling, Controlled Inputs, Lifting State Up |
| Lab 3 | Callbacks Through Layers, Filtering State, Conditional Rendering |

---

## The Final App — All Concepts in One Place

Your finished app demonstrates these core React principles:

| Principle | How the app shows it |
|-----------|---------------------|
| **Component-based** | UI is split into `App`, `AddTodo`, `TodoList`, `TodoItem` |
| **One-way data flow** | Data (todos) flows down from App via props |
| **State drives UI** | When `todos` changes, the screen updates automatically |
| **Immutable updates** | We never modify arrays directly — always create new ones |
| **Events bubble up** | Child components call parent callbacks to trigger changes |

---

## Challenge (Optional)

Try these on your own:

1. Add a "Clear All" button that deletes every todo at once
2. Show a count: "3 todos remaining" above the list
3. Add a "toggle done" feature — click a todo's text to cross it out (hint: use `textDecoration: 'line-through'`)
4. Save todos to `localStorage` so they survive page refresh (hint: look up `useEffect`)

---

## Congratulations!

You've built a complete React app from scratch! You now understand the most important ideas in React:
- Breaking UI into components
- Passing data with props
- Managing changing data with state
- Handling user events
- Rendering things conditionally

These same patterns are used in every React app — from small projects to apps like Instagram, Netflix, and Airbnb!
