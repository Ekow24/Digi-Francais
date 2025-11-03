# Digi Français  
### Your AI-Powered Language Learning Assistant  

Digi Français is an interactive AI web app that helps users learn new languages through speech recognition, real-time translation, text-to-speech playback, and AI-generated vocabulary quizzes, all powered by Google’s **Gemini 2.5 Flash** models.  

---

**Available at:** https://digi-francais-h79u5h9l9-ekow24s-projects.vercel.app

---
## Features  

-  **Voice Input (Speech Recognition):** Speak in English and let the app automatically transcribe your words.  
-  **AI Translation:** Instantly translate spoken sentences into your chosen language (French, Spanish, German, Italian, or Japanese).  
-  **Text-to-Speech Playback:** Hear the translation spoken aloud with natural Gemini TTS voices.  
-  **Interactive Quizzes:** Test your understanding through AI-generated multiple-choice questions based on your translation.  
-  **Gamified Feedback:** Celebrate correct answers with confetti and sound effects!  
-  **Powered by Google Gemini 2.5:** Uses `@google/genai` for translation, TTS, and quiz generation.  

---

## Tech Stack  

| Layer | Technology |
|-------|-------------|
| Frontend | React + TypeScript |
| AI Model | Google Gemini 2.5 Flash / Gemini 2.5 Flash Preview (TTS) |
| Speech Recognition | Web Speech API |
| Audio | Web Audio API |
| Styling | CSS-in-JS (in-component styles) |

---

## Setup Instructions  

### Clone the repository  
```bash
git clone https://github.com/Ekow24/Digi-Francais.git
cd Digi-Francais
```

### Install dependencies  
```bash
npm install
```

### Set up your Google API key  
Create a `.env` file in the project root and add:  
```
API_KEY=your_google_api_key_here
```

### Run the app  
```bash
npm start
```
Then visit **http://localhost:3000** to start learning!

---

## How It Works  

1. **Speech Recognition** – The app listens for your spoken English phrase and transcribes it in real time.  
2. **Translation (Gemini 2.5 Flash)** – The text is sent to Gemini for translation into your selected target language.  
3. **Text-to-Speech (Gemini 2.5 Flash Preview TTS)** – The translated sentence is converted into realistic spoken audio.  
4. **Quiz Generation** – Gemini generates a quick vocabulary question to reinforce what you learned.  
5. **Gamified Learning** – Get instant feedback, confetti, and sound cues for correct answers!  

---

## UI Overview  

| Component | Description |
|------------|-------------|
| 🎤 Mic Button | Start or stop voice capture |
| 🔁 Refresh Button | Clears state and resets the app |
| 🌐 Language Selector | Choose your target translation language |
| 🔊 Play Audio | Listen to Gemini’s pronunciation |
| ✨ Quiz Section | Auto-generated vocabulary quiz |
| 🎉 Confetti | Visual reward for correct answers |

---

## Key Files  

| File | Purpose |
|------|----------|
| `App.tsx` | Core React component with state, UI, and Gemini logic |
| `decodeAudioData()` | Converts Gemini TTS Base64 output into playable audio |
| `handleGenerateQuiz()` | Generates JSON-formatted quiz using Gemini schema |
| `STYLES` | Embedded CSS theme (light, minimalist aesthetic) |

---

## Environment Variables  

| Variable | Description |
|-----------|-------------|
| `API_KEY` | Your Gemini API key |

---

## Notes  

- Works best in **Chrome or Edge**, as Safari may not fully support the Web Speech API.  
- Ensure your microphone is enabled for speech input.  
- Audio playback requires user interaction before browser audio context can start.  

---

## Author  

**Ekow Mills-Nketsiah — AI Engineer & Researcher**  
Building intelligent multimodal systems that make learning engaging and accessible.



1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
