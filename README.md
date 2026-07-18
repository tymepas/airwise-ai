# 🌿 AirWise AI

> AI-powered Public Health Assistant built with **Next.js**, **Gemini AI**, and **Elasticsearch RAG** to provide trusted, evidence-based air quality and health recommendations.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8)
![Gemini](https://img.shields.io/badge/Google-Gemini-blue)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-9.x-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📖 Overview

AirWise AI is an intelligent public health assistant that helps users make informed decisions about outdoor activities and air quality.

Instead of relying solely on a large language model, AirWise AI combines **Retrieval-Augmented Generation (RAG)** with **Elasticsearch** to retrieve trusted public health guidance before generating responses with **Google Gemini**.

This approach provides responses that are:

- ✅ Grounded in trusted sources
- ✅ Context-aware
- ✅ More reliable than standalone AI responses
- ✅ Explainable with cited references

---

## ✨ Features

- 🔍 Retrieval-Augmented Generation (RAG)
- 🤖 Google Gemini AI integration
- 📚 Elasticsearch knowledge retrieval
- 🏥 WHO & CPCB health guideline support
- 📄 Structured JSON responses
- 🎯 Context-aware recommendations
- ⚡ Fast Next.js App Router backend
- 🎨 Modern responsive UI with Tailwind CSS

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | Frontend & API |
| TypeScript | Type Safety |
| Tailwind CSS | UI Styling |
| Google Gemini | AI Reasoning |
| Elasticsearch | Knowledge Retrieval |
| Elastic Cloud | Search Infrastructure |

---

# 🧠 Architecture

```
                User
                  │
                  ▼
        Next.js API Route
                  │
                  ▼
      Elasticsearch Retrieval
                  │
      (WHO/CPCB Guidelines)
                  │
                  ▼
         Retrieved Context
                  │
                  ▼
          Google Gemini AI
                  │
                  ▼
        Structured JSON Output
                  │
                  ▼
             Beautiful UI
```

---

# 🚀 How It Works

1. User submits a health or air quality question.
2. Elasticsearch retrieves the most relevant health guidance.
3. Retrieved documents are injected into the AI prompt.
4. Gemini reasons only over the provided context.
5. The application returns:

- Decision
- Reason
- Recommended Actions
- Sources

---

# 📁 Project Structure

```
app/
 ├── api/
 │    ├── chat/
 │    ├── elastic/
 │    └── search/
 │
 ├── page.tsx
 │
lib/
 ├── elastic.ts
 ├── gemini.ts
 └── ...
```

---

# 📦 Installation

Clone the repository

```bash
git clone https://github.com/tymepas/airwise-ai.git
```

Move into the project

```bash
cd airwise-ai
```

Install dependencies

```bash
npm install
```

Run the development server

```bash
npm run dev
```

---

# 🔑 Environment Variables

Create a `.env.local`

```env
GEMINI_API_KEY=your_gemini_api_key

ELASTICSEARCH_URL=your_elasticsearch_url

ELASTICSEARCH_API_KEY=your_elasticsearch_api_key
```

---

# 💡 Example Questions

- Can I play outside today?
- Is it safe for children to exercise outdoors?
- What precautions should senior citizens take during poor air quality?
- How does PM2.5 affect health?
- Should I wear a mask if AQI is poor?
- What does WHO recommend for outdoor activities?

---



# 🔮 Future Improvements

- Semantic Vector Search
- Hybrid Search
- Query Expansion
- Live AQI Integration
- Weather Integration
- Multi-city Support
- Personalized Health Profiles
- Voice Assistant
- Mobile Application

---

# 🎯 Why RAG?

Traditional AI systems generate responses from model memory.

AirWise AI instead retrieves trusted health guidance first, allowing the model to generate answers grounded in authoritative information.

Benefits include:

- Improved factual accuracy
- Reduced hallucinations
- Source-backed responses
- Easier knowledge updates

---

# 🤝 Contributing

Contributions are welcome!

Feel free to fork the repository, submit issues, or create pull requests.

---



# 👨‍💻 Author

**Garvit Mathur**

Project created as part of an AI + Elasticsearch hackathon.

If you found this project useful, consider giving it a ⭐ on GitHub.