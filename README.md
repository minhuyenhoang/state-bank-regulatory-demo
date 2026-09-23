# State Bank Regulatory Search

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `GROQ_API_KEY` and `MONGODB_URL` in `.env`
3. Run the app:
   `npm run dev`

For a standalone production server, run `npm run build`,
`npm run build:server`, then `npm start`.

## Deploy to Vercel

1. Import the repository into Vercel. The included `vercel.json` builds the
   Vite client and routes `/api/*` requests to the Express serverless function.
2. Add `MONGODB_URL`, `MONGODB_DB_NAME`, and `GROQ_API_KEY` in **Project
   Settings > Environment Variables**. `MONGODB_DB_NAME` defaults to
   `regulatory` when omitted.
3. If MongoDB Atlas is used, allow connections from Vercel in Atlas Network
   Access. Prefer a restricted rule or a supported private connection.
4. Redeploy after changing environment variables.
