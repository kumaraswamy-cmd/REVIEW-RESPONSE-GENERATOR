# 🚀 Review Response Generator

An elegant, AI-assisted Google and Yelp review response generator tailored for small businesses. This application automatically analyzes customer reviews (sentiment, key topics, risk assessment) and drafts search-optimized, professional responses using either a highly-optimized local rule engine or OpenAI's GPT models.

---

## ✨ Features

- **Dual-Engine Response Drafting:** 
  - **Local Mode:** Generates responses completely offline using a local business rules engine (100% free, no API key needed).
  - **AI Mode:** Leverages OpenAI API (e.g. GPT models) for highly contextual, natural responses.
- **Sentiment & Topic Analysis:** Automatically flags positive, negative, or mixed reviews, identifying key subjects (service, quality, food, cleanliness, etc.).
- **SEO Optimization:** Seamlessly embeds your business category, city, and custom keywords to boost local search rankings naturally.
- **Risk Mitigation:** Automatically flags sensitive terms (e.g., refunds, lawsuits, injury, hygiene warnings) so replies can be checked prior to posting.
- **Zero Dependencies:** Developed using pure Node.js core modules. No `npm install` needed—starts instantly!

---

## ⚡ Quick Start (Windows)

If you are on Windows, you can launch the app instantly:

1. Double-click the **`start.bat`** file in the root of the folder.
2. If it's your first time running, you will be prompted to optionally enter your **OpenAI API Key**.
   - *Press **Enter** to skip and run in free offline local mode.*
   - *If entered, the key is automatically saved to a local `.env` file (which is ignored by Git for security).*
3. The server will start, and the application will automatically open in your default web browser at [http://127.0.0.1:5187](http://127.0.0.1:5187).

---

## 💻 Manual Setup & Run (All OS)

### 📋 Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v16 or higher is recommended).

### 🚀 Running the App
1. Open your terminal/command prompt.
2. Navigate to the project directory:
   ```bash
   cd "C:\Users\nihal\Desktop\PROJECT KUMAR\PROJECTS\REVIEW RESPONSE GENERATOR"
   ```
3. Run the application:
   ```bash
   node server.js
   ```
   *(Or using package.json script: `npm start`)*
4. Open your browser and go to [http://127.0.0.1:5187](http://127.0.0.1:5187).

---

## 🔑 Environment Variables & AI Configuration

To configure OpenAI features manually, create a `.env` file in the root directory (do not commit this file to Git):

```env
OPENAI_API_KEY=your-actual-api-key-here
OPENAI_MODEL=gpt-4.1-mini
PORT=5187
HOST=127.0.0.1
```

- **`OPENAI_API_KEY`**: Your OpenAI platform API key. If absent, the app falls back to Local Mode.
- **`OPENAI_MODEL`**: The OpenAI chat completion model to use (defaults to `gpt-4.1-mini`).
- **`PORT`**: The server port (defaults to `5187`).
- **`HOST`**: The host address (defaults to `127.0.0.1`).

---

## 📦 How to Push to GitHub

Follow these steps to upload this project to your GitHub account:

### 1. Create a Repository on GitHub
1. Go to [GitHub](https://github.com/) and log in.
2. Click the **New** button (or "+" sign in the top-right corner) to create a new repository.
3. Name your repository (e.g., `review-response-generator`).
4. Keep it **Public** or **Private** as desired.
5. **Do not** check "Add a README file", "Add .gitignore", or "Choose a license" (we already have these in the project).
6. Click **Create repository**.

### 2. Initialize Git & Push from Your Computer
Open your command line/terminal, navigate to your project directory, and run the following commands:

```bash
# 1. Initialize git (if not already done)
git init

# 2. Add all project files to staging (our .gitignore keeps your API keys safe!)
git add .

# 3. Create your first commit
git commit -m "Initial commit: Review Response Generator with start.bat"

# 4. Rename the default branch to main
git branch -M main

# 5. Link your local repository to GitHub (replace with your GitHub URL)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/review-response-generator.git

# 6. Push your project to GitHub
git push -u origin main
```

*(Note: Replace `YOUR_GITHUB_USERNAME` in step 5 with your actual GitHub username).*
