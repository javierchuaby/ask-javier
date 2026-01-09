This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
GOOGLE_GENAI_API_KEY=your_google_generative_ai_api_key_here
MONGODB_URI=your_mongodb_atlas_connection_string_here
```

- **GOOGLE_GENAI_API_KEY**: Your Google Generative AI API key. Get it from [Google AI Studio](https://makersuite.google.com/app/apikey).
- **MONGODB_URI**: Your MongoDB Atlas connection string. Format: `mongodb+srv://username:password@cluster.mongodb.net/ask-javier?retryWrites=true&w=majority`

### Running the Development Server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

### Vercel Deployment Setup

1. Push your code to GitHub
2. Import your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `GOOGLE_GENAI_API_KEY`: Your Google Generative AI API key
   - `MONGODB_URI`: Your MongoDB Atlas connection string
4. Deploy!

The app will automatically use MongoDB Atlas for persistent chat storage across deployments.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
