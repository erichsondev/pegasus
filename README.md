# 🐎 Pegasus Finance

A robust Fullstack Personal Finance Platform designed for speed and automation. Pegasus helps users track expenses, manage recurring transactions, and visualize their financial health through interactive dashboards.

## 🚀 Live Demo
**https://pegasus-taupe.vercel.app/**

## 🛠 Tech Stack
- **Frontend:** React + Vite, Tailwind CSS, Shadcn/UI, Lucide React.
- **Backend:** Node.js (Express), JWT Authentication, Bcrypt.
- **Database:** PostgreSQL (Supabase) with Connection Pooling (Transaction Mode).
- **Deployment:** Vercel (Frontend), Render (Backend).

## ✨ Key Features
- **Smart Recurring Transactions:** An automated engine that handles monthly expenses and income.
- **Secure Auth:** Industry-standard JWT authentication for data privacy.
- **Real-time Dashboards:** Interactive charts and summaries for quick financial insights.
- **Responsive Design:** Fully optimized for both desktop and mobile devices.

## 🔧 Installation & Local Setup
1. Clone the repo: `git clone https://github.com/erichsondev/pegasus.git`
2. Install dependencies: `npm install`
3. Configure your `.env` file with your Supabase credentials.
4. Run the development server: `npm run dev`

## 🛡️ Security Note
This project implements security best practices such as environment variable protection, password hashing with Bcrypt, and protected API routes.