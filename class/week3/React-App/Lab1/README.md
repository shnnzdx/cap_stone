# Lab 1: Components, JSX & Props

## What You Will Learn

In this lab you will learn the three most important building blocks of React:

1. **Components** — Reusable pieces of your website (like LEGO bricks)
2. **JSX** — A special way to write HTML inside JavaScript
3. **Props** — How components talk to each other (passing data from parent to child)

---

## Prerequisites

Make sure you have these installed on your computer:

- **Node.js** (version 18 or higher) — download from https://nodejs.org
- **VS Code** (or any code editor)

To check if Node.js is installed, open a terminal and type:

```
node --version
```

You should see something like `v18.x.x` or higher.

---

## Step 1: Create Your Project

Open a terminal (Command Prompt, PowerShell, or VS Code terminal) and run:

```
npm create vite@latest Lab1
```

It will ask you a few questions:
- **Package name:** type `todo-app` and press Enter
- **Select a framework:** use the arrow keys to highlight **React**, then press Enter
- **Select a variant:** choose **JavaScript** and press Enter
- **Linter:** just press Enter to accept the default
- **Install and start now:** choose No (we will do this manually)

Now go into your project folder:

```
cd Lab1
```

Install the packages React needs:

```
npm install
```

---

## Step 2: Clean Up the Starter Files

Vite gives you some demo files we don't need. Let's remove them.

1. Delete everything inside the `src/` folder
2. Delete the `public/` folder (we don't need a favicon for now)

Your project should now look like this:

```
Lab1/
├── index.html
├── package.json
├── vite.config.js
└── src/          ← empty!
```

---

## Step 3: Create Your First Component — `App.jsx`

Inside the `src/` folder, create a new file called **`App.jsx`**.

Type this code:

```jsx
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
```

### What's happening here?

| Line | What it does |
|------|-------------|
| `function App()` | This creates a **component** — a reusable piece of UI |
| `const todos = [...]` | A list (array) of todo items. Each has an `id` and `text` |
| `return (...)` | The **JSX** — looks like HTML but it's inside JavaScript! |
| `<TodoList todos={todos} />` | We use our `TodoList` component and pass data to it using **props** |
| `export default App` | Makes this component available to other files |

> **Key Concept: JSX**  
> JSX lets you write HTML-like code inside JavaScript. Notice we use `className` instead of `class` (because `class` is already a JavaScript word).

---

## Step 4: Create the `TodoList` Component — `TodoList.jsx`

Create a new file in `src/` called **`TodoList.jsx`**.

Type this code:

```jsx
import TodoItem from './TodoItem'

function TodoList({ todos }) {
  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem key={todo.id} text={todo.text} />
      ))}
    </ul>
  )
}

export default TodoList
```

### What's happening here?

| Line | What it does |
|------|-------------|
| `{ todos }` | This is a **prop** — data passed in from the parent (`App`) |
| `todos.map(...)` | Loops through each todo in the array |
| `<TodoItem key={todo.id} text={todo.text} />` | Creates a `TodoItem` for each todo |
| `key={todo.id}` | React needs a unique `key` for each item in a list so it can track changes |

> **Key Concept: Props**  
> Props are like arguments you pass to a function. The parent component (`App`) passes data DOWN to child components (`TodoList`). Data always flows one way: parent → child.

> **Key Concept: Lists & Keys**  
> When you display a list of items, use `.map()` to loop and always give each item a unique `key`.

---

## Step 5: Create the `TodoItem` Component — `TodoItem.jsx`

Create a new file in `src/` called **`TodoItem.jsx`**.

Type this code:

```jsx
function TodoItem({ text }) {
  return <li className="todo-item">{text}</li>
}

export default TodoItem
```

### What's happening here?

This is the simplest component! It receives one prop (`text`) and displays it inside an `<li>` tag.

> **Key Concept: Components are like LEGO bricks**  
> `TodoItem` is small and does one thing. `TodoList` uses many `TodoItem`s. `App` uses `TodoList`. You build big things from small pieces!

---

## Step 6: Create the Entry Point — `main.jsx`

Create a new file in `src/` called **`main.jsx`**.

Type this code:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

This file tells React: "Take my `App` component and put it on the web page inside the element with id `root`."

---

## Step 7: Add Some Style — `App.css`

Create a new file in `src/` called **`App.css`**.

Type this code:

```css
.app {
  max-width: 400px;
  margin: 40px auto;
  font-family: sans-serif;
}

.app h1 {
  text-align: center;
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

---

## Step 8: Run Your App!

In your terminal (make sure you're inside the `Lab1` folder), run:

```
npm run dev
```

Open your browser and go to: **http://localhost:5173**

You should see your todo list with 3 items!

---

## How the Pieces Fit Together

```
App  (has the data)
 │
 └── passes todos as a prop ──→  TodoList  (loops through the list)
                                      │
                                      └── passes text as a prop ──→  TodoItem  (shows one item)
```

This is called **"one-way data flow"** — data flows from parent to child through props.

---

## Review: What You Learned

| Concept | What it means | Where you saw it |
|---------|--------------|-----------------|
| Component | A function that returns JSX (a piece of UI) | `App`, `TodoList`, `TodoItem` |
| JSX | HTML-like syntax inside JavaScript | Everything inside `return (...)` |
| Props | Data passed from parent to child | `todos` passed to `TodoList`, `text` passed to `TodoItem` |
| Lists & Keys | Rendering arrays with `.map()` and unique `key` | `TodoList` mapping over todos |

---

## Challenge (Optional)

Try these on your own:

1. Add a 4th todo item to the array in `App.jsx`
2. Add a new prop called `done` (true/false) to each todo and display "✓" next to completed ones
3. Create a new component called `Header` that shows the app title instead of putting `<h1>` directly in `App`

---

## What's Next?

In **Lab 2**, you'll make this app interactive — users will be able to type and add new todos using **state** and **event handling**!
