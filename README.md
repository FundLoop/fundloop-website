# FundLoop - A Network State for Mutual Prosperity

FundLoop connects projects and users in a revenue sharing ecosystem. Projects
pledge 1% of their revenue and active users receive a recurring citizen salary.
The platform is built with Next.js, TypeScript and Supabase.

## Vision

FundLoop aims to build a sustainable economy where prosperity is shared between
ethical projects and the community that supports them.

## Features

### Users
- Receive a citizen salary from the ecosystem revenue pool
- Discover projects aligned with personal values
- Contribute skills to projects
- Join a community of like-minded builders

### Projects
- Pledge 1% of revenue back to the ecosystem
- Connect with engaged users
- Manage payments and view analytics

### Platform
- Multi-step onboarding flows for users and projects
- Supabase powered authentication and database
- Admin dashboard and audit logging
- Responsive design with full dark/light mode

## Tech Stack

- **Next.js 15** with the App Router
- **TypeScript** and **React 19**
- **Tailwind CSS** and **shadcn/ui** for styling
- **Supabase** and **PostgreSQL** for data and auth

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm
- A Supabase project

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/fundloop.git
   cd fundloop
   ```
2. Install dependencies
   ```bash
   pnpm install # or npm install
   ```
3. Configure environment variables
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Run the development server
   ```bash
   pnpm dev # or npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

SQL files in the `database/` directory define the schema and seed data.
Run them in order using the Supabase SQL editor or `psql` against your
project database.

## Project Structure

- `app/` – Next.js pages and layouts
- `components/` – Reusable React components and UI primitives
- `hooks/` – Custom React hooks
- `lib/` – Utilities including the Supabase client
- `database/` – SQL schema and seed scripts
- `types/` – Generated TypeScript types for Supabase

## Running Lint

Use the provided script to lint the project:

```bash
pnpm lint # or npm run lint
```

## Deployment

The project can be deployed to Vercel. Configure environment variables in the
Vercel dashboard and it will build automatically on push to the `main` branch.

## License

FundLoop is released under the [MIT License](LICENSE).

