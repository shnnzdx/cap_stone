# React Todo App — Learning Labs

A progressive, hands-on React learning series that builds a fully functional Todo application across three labs. Each lab introduces core React concepts incrementally, resulting in a complete app with add and delete functionality.

---

## Project Structure

```
React-App/
├── Lab1/   → Components, JSX & Props
├── Lab2/   → State & Event Handling
├── Lab3/   → Delete & Conditional Rendering
```

---

## Summary of Learnings

### Lab 1: Components, JSX & Props

The foundation — build a static todo list by breaking UI into reusable pieces.

**Key Concepts:**
- **Components** — Functions that return JSX; reusable building blocks of UI (`App`, `TodoList`, `TodoItem`)
- **JSX** — HTML-like syntax inside JavaScript (use `className` instead of `class`)
- **Props** — Data passed from parent to child; one-way data flow
- **Lists & Keys** — Render arrays with `.map()` and always provide a unique `key`

**Data Flow:**
```
App (has the data)
 └── passes todos → TodoList (loops through the list)
                        └── passes text → TodoItem (shows one item)
```

---

### Lab 2: State & Event Handling

Make the app interactive — users can type and add new todos.

**Key Concepts:**
- **State (`useState`)** — Data that changes over time; triggers re-render when updated
- **Event Handling** — Responding to user actions (`onSubmit`, `onChange`)
- **Controlled Inputs** — Input value tied to state (`value={text}` + `onChange`)
- **Lifting State Up** — State lives in the highest component that needs it; callbacks passed to children
- **Immutable Updates** — Never modify state directly; create new copies (`[...todos, newTodo]`)

**Data Flow:**
```
App (owns the todos state)
 ├── passes onAdd callback → AddTodo (calls onAdd when user submits)
 └── passes todos as prop  → TodoList → TodoItem
```

---

### Lab 3: Delete & Conditional Rendering

Complete the app — users can delete todos and see an empty state message.

**Key Concepts:**
- **Passing Callbacks Through Multiple Levels** — Grandchild component communicates back to grandparent via prop drilling (`App → TodoList → TodoItem`)
- **Filtering State** — Remove items with `.filter()` without mutating the original array
- **Conditional Rendering** — Show different UI based on conditions (`if`, ternary `? :`, `&&` operator)

**Data Flow:**
```
App (owns state: todos)
 ├── passes onAdd → AddTodo
 │                    └── user submits → calls onAdd(text) → App adds to state
 └── passes todos + onDelete → TodoList
                                  ├── if empty → shows "No todos yet!"
                                  └── for each todo → TodoItem
                                                        └── user clicks Delete → calls onDelete(id) → App removes from state
```

---

## Core React Principles Demonstrated

| Principle | How the app shows it |
|-----------|---------------------|
| **Component-based** | UI is split into `App`, `AddTodo`, `TodoList`, `TodoItem` |
| **One-way data flow** | Data (todos) flows down from `App` via props |
| **State drives UI** | When `todos` changes, the screen updates automatically |
| **Immutable updates** | Arrays are never modified directly — always create new ones |
| **Events bubble up** | Child components call parent callbacks to trigger changes |

---

## Getting Started

Each lab is a standalone Vite + React project. To run any lab:

```bash
cd Lab1   # or Lab2, Lab3
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Prerequisites

- **Node.js** (version 18 or higher) — [download here](https://nodejs.org)
- **VS Code** (or any code editor)
