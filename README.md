# NotesChatAI

Your persistent AI study assistant. Upload notes, textbooks, and PDFs once, then chat with an AI that remembers everything across sessions.

## Features

- **Persistent Memory**: Unlike ChatGPT or NotebookLM, your knowledge base grows forever. No 50-source limits. No notebook isolation.
- **Global Semantic Search**: Vector-powered search across all your documents instantly.
- **Citations You Can Trust**: Every answer cites exact passages. Hover to preview, click to jump.
- **Audio Overviews**: Podcast-style summaries with full transcripts, chapters, and speed control.
- **Interactive Mind Maps**: Visualize connections between concepts. Click nodes to explore.
- **Spaced Repetition Flashcards**: Auto-generate cloze, basic, and reversed cards with FSRS algorithm.
- **Quiz Generator**: Create MCQs, short answer, and explanation questions from any document subset.
- **Developer API**: REST + GraphQL API, webhooks, TypeScript/Python/Go SDKs.
- **Privacy-First**: Your data never trains models. Self-hosted option available.

## Tech Stack

- **Frontend**: Astro 5 + React Islands + Tailwind CSS v4
- **Backend**: Hono on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) + Vectorize (vector search)
- **Storage**: Cloudflare R2
- **Queue**: Cloudflare Queues
- **Auth**: Better Auth (email/password + Google OAuth)
- **AI**: Gemini API (chat) + Workers AI (embeddings: bge-base-en-v1.5)
- **ORM**: Drizzle ORM

## Getting Started

### Prerequisites

- Node.js 22+
- Cloudflare account (for Workers, D1, Vectorize, R2, Queues)
- Google Cloud Console project (for OAuth)
- Google AI Studio API key (for Gemini)

### Installation

```bash
# Clone and install
git clone https://github.com/noteschatai/noteschatai.git
cd noteschatai
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Set up database (run migrations)
npm run db:push

# Start development servers
npm run dev          # Frontend (Astro) on http://localhost:4321
npm run worker:dev   # Backend (Workers) on http://localhost:8787
```

### Cloudflare Setup

1. **Create D1 Database**:
   ```bash
   wrangler d1 create noteschatai-db
   # Update wrangler.toml with database_id
   ```

2. **Create Vectorize Index**:
   ```bash
   wrangler vectorize create document-chunks --dimensions=768 --metric=cosine
   # Update wrangler.toml with index name
   ```

3. **Create R2 Bucket**:
   ```bash
   wrangler r2 bucket create noteschatai-files
   ```

4. **Create Queue**:
   ```bash
   wrangler queues create document-processing
   ```

5. **Set Secrets**:
   ```bash
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put GEMINI_API_KEY
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   ```

## Project Structure

```
noteschatai/
├── public/                 # Static assets
├── src/
│   ├── components/
│   │   └── ui/            # Design system components
│   ├── content/
│   │   ├── blog/          # Blog posts (MDX)
│   │   └── docs/          # Documentation (MDX)
│   ├── layouts/           # Page layouts
│   ├── pages/
│   │   ├── api/           # API routes (Astro)
│   │   ├── app/           # App pages (dashboard, chat, etc.)
│   │   ├── auth/          # Auth pages
│   │   ├── blog/          # Blog pages
│   │   └── index.astro    # Marketing homepage
│   ├── styles/
│   │   └── global.css     # Tailwind + design tokens
│   ├── utils/             # Utility functions
│   └── worker/            # Cloudflare Worker backend
│       ├── db/            # Drizzle schema & connection
│       ├── routes/        # API routes (Hono)
│       └── queue/         # Queue consumers
├── migrations/            # D1 SQL migrations
├── astro.config.mjs       # Astro + Starlight config
├── tailwind.config.mjs    # Tailwind v4 + design tokens
├── drizzle.config.ts      # Drizzle ORM config
├── wrangler.toml          # Cloudflare Workers config
└── package.json
```

## Design System

Based on Vercel's design language (from DESIGN.md):

- **Colors**: Ink (#171717) primary, Canvas/Canvas-Soft backgrounds, Cyan/Violet/Pink accents
- **Typography**: Geist/Inter (sans), Geist Mono/JetBrains Mono (mono)
- **Spacing**: 4px base unit, generous section padding (96px)
- **Components**: Pill buttons (100px radius), cards with stacked shadows, hairline borders
- **Shadows**: 5-level stacked shadow system

## Deployment

### Frontend (Cloudflare Pages)

```bash
npm run build
# Deploy dist/ to Cloudflare Pages
# Build command: npm run build
# Output directory: dist
```

### Backend (Cloudflare Workers)

```bash
npm run worker:deploy
```

### Environment Variables (Production)

Set in Cloudflare dashboard:
- All secrets from `.env.example`
- `BETTER_AUTH_URL=https://noteschatai.com`

## API Documentation

See `/docs/api/introduction` for full API reference.

### Quick Example

```typescript
import { NotesChatAI } from '@noteschatai/sdk';

const client = new NotesChatAI({
  apiKey: process.env.NOTESCHATAI_API_KEY,
});

// Upload a document
const doc = await client.documents.upload({
  file: fs.createReadStream('./notes.pdf'),
  title: 'ML Lecture Notes',
});

// Chat with RAG
const stream = await client.chat.stream({
  message: 'What are the key concepts in my ML notes?',
  model: 'gemini-1.5-flash',
  retrieval: { topK: 10, rerank: true },
});

for await (const chunk of stream) {
  if (chunk.type === 'citation') {
    console.log('Source:', chunk.documentTitle, chunk.page);
  } else if (chunk.type === 'text') {
    process.stdout.write(chunk.text);
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run typecheck`
5. Submit a PR

## License

MIT License - see LICENSE file for details.

## Support

- **Discord**: [discord.gg/noteschatai](https://discord.gg/noteschatai)
- **Email**: hello@noteschatai.com
- **Issues**: [GitHub Issues](https://github.com/noteschatai/noteschatai/issues)

---

Built with ❤️ for students and researchers everywhere.