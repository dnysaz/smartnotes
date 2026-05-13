# Smart Note

Your intelligent workspace for notes, tasks, and finances.

## Features

- **Notes** — Rich text notes with live preview
- **Todo Lists** — Checkboxes, add/delete items
- **Financial Tracker** — Income/expense records with PDF export
- **AI Scan** — Scan handwritten/digital lists via camera (powered by Gemini)
- **Google Drive Sync** — Backup & sync across devices
- **Search** — Full-text search across all items
- **Trash** — Recover deleted items

## Tech Stack

- Vite + vanilla JavaScript
- Tailwind CSS
- Google Drive API (REST)
- Gemini AI API
- jsPDF for PDF export

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `VITE_GOOGLE_API_KEY` | No | Google Drive API key |
| `GEMINI_API_KEY` | For AI scan | Gemini API key (server-side only) |

Set `GEMINI_API_KEY` before running:

```bash
export GEMINI_API_KEY=your_key_here
npm run dev
```

## Deployment

Deploy to Vercel with zero config — Vite is auto-detected.

Add env vars in Vercel → Project Settings → Environment Variables.

## License

MIT
