# Lab 2: State & Event Handling

## What You Will Learn

In this lab you will make your todo app **interactive**! By the end, users will be able to type a new todo and add it to the list.

You will learn:

1. **State (`useState`)** — How a component remembers things that can change
2. **Event Handling** — How to respond when a user clicks a button or types in an input
3. **Controlled Inputs** — How React keeps track of what's typed in a text box
4. **Lifting State Up** — Keeping data in a parent so multiple children can use it

---

## Starting Point

You should have your completed **Lab 1** project. If you don't, copy the Lab 1 solution folder and rename it `Lab2`.

Your starting files:

```
Lab2/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx        ← we will change this
    ├── TodoList.jsx   ← stays the same
    ├── TodoItem.jsx   ← stays the same
    └── App.css        ← we will add styles
```

---

## Quick Recap from Lab 1

In Lab 1, your `App.jsx` had a **hardcoded** list of todos:

```jsx
const todos = [
  { id: 1, text: 'Learn about components' },
  { id: 2, text: 'Understand JSX' },
  { id: 3, text: 'Pass props to components' },
]
```

The problem? This list can never change! If we want users to add new todos, we need **state**.

---

## Step 1: What is State?

**State** is data that can change over time. When state changes, React automatically updates the screen.

Think of it like this:
- **Props** = a letter someone hands you (you can read it, but you can't change it)
- **State** = your own notebook (you can write in it and erase things whenever you want)

React gives us a special tool called `useState` to create state.

---

## Step 2: Convert the Hardcoded Array to State

Open **`src/App.jsx`** and change it to this:

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

  return (
    <div className="app">
      <h1>My Todo App</h1>
      <AddTodo onAdd={addTodo} />
      <TodoList todos={todos} />
    </div>
  )
}

export default App
```

### What changed from Lab 1?

| What's new | What it does |
|-----------|-------------|
| `import { useState } from 'react'` | Brings in the `useState` tool from React |
| `const [todos, setTodos] = useState([...])` | Creates state! `todos` is the current value, `setTodos` is the function to update it |
| `function addTodo(text)` | A function that adds a new todo to the list |
| `setTodos([...todos, newTodo])` | Updates state by creating a NEW array with all old todos + the new one |
| `<AddTodo onAdd={addTodo} />` | A new component (we'll create it next!) that gets the `addTodo` function as a prop |

> **Key Concept: useState**  
> `useState` returns two things in an array:
> 1. The current value (like `todos`)
> 2. A function to change it (like `setTodos`)
>
> When you call `setTodos(...)`, React re-renders the component with the new data!

> **Key Concept: Never change state directly!**  
> Don't do `todos.push(newTodo)` — that changes the array in place and React won't know something changed.  
> Instead, create a NEW array: `[...todos, newTodo]` (the `...` copies all existing items, then adds the new one).

---

## Step 3: Create the `AddTodo` Component — `AddTodo.jsx`

Create a new file in `src/` called **`AddTodo.jsx`**.

Type this code:

```jsx
import { useState } from 'react'

function AddTodo({ onAdd }) {
  const [text, setText] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (text.trim() === '') return
    onAdd(text)
    setText('')
  }

  return (
    <form className="add-todo" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a new todo..."
      />
      <button type="submit">Add</button>
    </form>
  )
}

export default AddTodo
```

### What's happening here?

| Line | What it does |
|------|-------------|
| `{ onAdd }` | A prop — the `addTodo` function passed down from `App` |
| `const [text, setText] = useState('')` | State for what the user is typing (starts empty) |
| `handleSubmit(e)` | Runs when the form is submitted |
| `e.preventDefault()` | Stops the page from refreshing (default form behavior) |
| `if (text.trim() === '') return` | Don't add empty todos! |
| `onAdd(text)` | Calls the parent's `addTodo` function with the typed text |
| `setText('')` | Clears the input after adding |
| `value={text}` | The input always shows what's in state |
| `onChange={(e) => setText(e.target.value)}` | Every time the user types, update state |

> **Key Concept: Controlled Input**  
> The input's value is controlled by React state (`value={text}`). When the user types, we update state (`onChange`), which updates the input. React is always in control — that's why it's called a "controlled input."

> **Key Concept: Event Handling**  
> - `onSubmit` fires when a form is submitted (button click or Enter key)
> - `onChange` fires every time the user types a character
> - The `e` (event) object has info about what happened. `e.target.value` is what's currently in the input.

> **Key Concept: Lifting State Up**  
> The `AddTodo` component doesn't own the todo list — `App` does. So `AddTodo` calls `onAdd(text)` to tell the parent "hey, add this!" The parent updates its own state.  
> This is called **lifting state up** — the state lives in the highest component that needs it.

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
  padding: 10px;
  margin: 6px 0;
  background: #f4f4f4;
  border-radius: 4px;
}
```

The new styles make the input and button sit side by side and look nice.

---

## Step 5: Run Your App!

In your terminal, run:

```
npm run dev
```

Open **http://localhost:5173** and try it out:
1. Type something in the input box
2. Click "Add" (or press Enter)
3. Watch your new todo appear in the list!

---

## How Data Flows Now

```
App  (owns the todos state)
 │
 ├── passes onAdd callback ──→  AddTodo  (calls onAdd when user submits)
 │                                  │
 │                                  └── user types → updates its own text state
 │
 └── passes todos as a prop ──→  TodoList  (displays the list)
                                      │
                                      └── TodoItem  (shows one item)
```

Notice:
- `App` owns the todo list (state)
- `AddTodo` tells `App` to add something (callback prop)
- `TodoList` just displays what `App` gives it (data prop)

---

## Review: What You Learned

| Concept | What it means | Where you saw it |
|---------|--------------|-----------------|
| State (`useState`) | Data that changes over time; triggers re-render | `todos` in App, `text` in AddTodo |
| Event Handling | Responding to user actions | `onSubmit`, `onChange` in AddTodo |
| Controlled Input | Input value tied to state | `value={text}` + `onChange` |
| Lifting State Up | State in the parent, callbacks passed to children | `addTodo` in App, `onAdd` in AddTodo |
| Immutable Updates | Never modify state directly; create new copies | `[...todos, newTodo]` |

---

## Challenge (Optional)

Try these on your own:

1. Show the total number of todos above the list (hint: `todos.length`)
2. Disable the "Add" button when the input is empty
3. Add a character limit — don't allow todos longer than 50 characters

---

## What's Next?

In **Lab 3**, you'll add the ability to **delete** todos and show a message when the list is empty using **conditional rendering**!
