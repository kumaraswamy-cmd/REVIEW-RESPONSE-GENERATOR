# Review Response Generator

AI-assisted review response tool for small business owners. It drafts Google and Yelp replies based on star rating, review text, business details, tone, and SEO keywords.

## Run

```powershell
cd "C:\Users\nihal\Desktop\PROJECT KUMAR\PROJECTS\REVIEW RESPONSE GENERATOR"
npm start
```

Open `http://127.0.0.1:5187/`.

## Optional AI mode

Set an OpenAI API key before starting the server:

```powershell
$env:OPENAI_API_KEY="your_api_key_here"
npm start
```

Optional model override:

```powershell
$env:OPENAI_MODEL="gpt-4.1-mini"
```

Without an API key, the app uses its built-in local drafting engine so it still works immediately.
