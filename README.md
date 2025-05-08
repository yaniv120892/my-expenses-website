# My Expenses Website

A Next.js web app for managing your expenses, connected to your existing my-expenses-api backend.

## Features

- List, create, edit, and delete transactions
- Search transactions by description, category, or date
- View summary of expenses
- Material UI design
- Loading and error states for API calls
- Form validation
- State management with React hooks and context

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set environment variables:**

   Create a `.env.local` file in the root:

   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
   ```

   Replace the URL with your actual API endpoint.

3. **Run the development server:**

   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000) in your browser.**

---

## Project Structure

- `components/` – Reusable UI components
- `services/` – API logic
- `types/` – TypeScript types
- `utils/` – Helper functions
- `app/` – Next.js App Router pages

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Material UI
- React Context & Hooks

---
