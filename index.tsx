
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Fix: Add type definitions for the Web Speech API to resolve TypeScript errors.
// --- Type Definitions for Speech Recognition API ---
interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    start(): void;
    stop(): void;
}
declare var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
};
declare var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
};
declare global {
    interface Window {
        SpeechRecognition: typeof SpeechRecognition;
        webkitSpeechRecognition: typeof webkitSpeechRecognition;
        AudioContext: typeof AudioContext;
        webkitAudioContext: typeof AudioContext;
    }
    // Fix: Add type definition for import.meta.env to resolve TypeScript error.
    interface ImportMeta {
        readonly env: {
            readonly VITE_API_KEY: string;
        };
    }
}

// --- Audio Utility Functions ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Confetti Utility ---
const triggerConfetti = () => {
    const confettiCount = 100;
    const confettiContainer = document.body;
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.animationDuration = `${Math.random() * 2 + 3}s`;
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confettiContainer.appendChild(confetti);
        setTimeout(() => {
            confetti.remove();
        }, 5000);
    }
};


// --- Main App Component ---
const App = () => {
    // --- State Management ---
    const [isListening, setIsListening] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [targetLanguage, setTargetLanguage] = useState('French');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<any>(null);
    const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | null>(null);
    const [isQuizCorrect, setIsQuizCorrect] = useState(false);


    // --- Refs ---
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const cumulativeTranscriptRef = useRef('');
    const aiRef = useRef<GoogleGenAI | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const debounceTimeoutRef = useRef<number | null>(null);


    // --- Constants ---
    const LANGUAGES = ['French', 'Spanish', 'German', 'Italian', 'Japanese'];
    const quizSchema = {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            answer: { type: Type.STRING }
        },
        required: ['question', 'options', 'answer']
    };

    // --- Initialization ---
    useEffect(() => {
        // Fix: Use import.meta.env.VITE_API_KEY for Vercel/Vite deployments.
        const apiKey = import.meta.env.VITE_API_KEY;
        if (!apiKey) {
            setError("API key not found. Please set the VITE_API_KEY environment variable in your deployment settings.");
            return;
        }
        aiRef.current = new GoogleGenAI({ apiKey });

         // Ensure AudioContext is initialized on first user interaction (or here for simplicity)
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscriptPart = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscriptPart += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscriptPart.trim()) {
                if (cumulativeTranscriptRef.current) {
                    cumulativeTranscriptRef.current += ' ';
                }
                cumulativeTranscriptRef.current += finalTranscriptPart.trim();
            }

            setRecognizedText(cumulativeTranscriptRef.current + ' ' + interimTranscript);
            
            if (finalTranscriptPart.trim()) {
                // Debounce translation to avoid hitting API rate limits
                if (debounceTimeoutRef.current) {
                    clearTimeout(debounceTimeoutRef.current);
                }
                debounceTimeoutRef.current = window.setTimeout(() => {
                    handleTranslation(cumulativeTranscriptRef.current, targetLanguage);
                }, 2000); // Wait 2 seconds after user stops talking

                setQuiz(null); 
                setSelectedQuizAnswer(null);
                setIsQuizCorrect(false);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognition.onerror = (event) => {
            setError(`Speech recognition error: ${event.error}`);
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        
        // Cleanup function to clear timeout on component unmount or re-render
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [targetLanguage]);

    // --- Core Functions ---
    const handleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleRefresh = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        cumulativeTranscriptRef.current = '';
        setRecognizedText('');
        setTranslatedText('');
        setError(null);
        setQuiz(null);
        setSelectedQuizAnswer(null);
        setIsQuizCorrect(false);
    };

    const handleTranslation = async (text: string, lang: string) => {
        if (!text.trim() || !aiRef.current) return;
        setIsLoading(true);
        setTranslatedText('');
        try {
            const prompt = `Provide the most common and direct translation of the following English text to ${lang}. Return ONLY the translated text, without any markdown, formatting, or additional explanations. Text to translate: "${text}"`;
            const response = await aiRef.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            setTranslatedText(response.text);
        } catch (e: any) {
            setError(`Translation failed: ${JSON.stringify(e.message || e)}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    const playSuccessSound = () => {
        if (!audioContextRef.current) return;
        const audioCtx = audioContextRef.current;
        // Check if context is suspended (due to browser policy) and resume if needed
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    };

    const handlePlayTranslationAudio = async () => {
        if (!translatedText || !aiRef.current || isGeneratingAudio) return;
        setIsGeneratingAudio(true);
        setError(null);
        try {
            const response = await aiRef.current.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: translatedText }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (base64Audio) {
                 if (!audioContextRef.current || audioContextRef.current.sampleRate !== 24000) {
                    if (audioContextRef.current) await audioContextRef.current.close();
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                }
                const audioContext = audioContextRef.current;
                 if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    audioContext,
                    24000,
                    1
                );
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start();
            } else {
                throw new Error("No audio data received from API.");
            }
        } catch (e: any) {
            setError(`Audio generation failed: ${JSON.stringify(e.message || e)}`);
            console.error(e);
        } finally {
            setIsGeneratingAudio(false);
        }
    };


    const handleGenerateQuiz = async () => {
        const textToQuiz = translatedText || recognizedText;
        if (!textToQuiz.trim() || !aiRef.current) return;
        setIsLoading(true);
        setQuiz(null);
        setSelectedQuizAnswer(null);
        setIsQuizCorrect(false);
        setError(null);

        try {
            const prompt = `Based on the ${targetLanguage} sentence "${textToQuiz}", create one simple multiple-choice vocabulary question to test a word from it. The question should be in English. Provide the correct answer.`;
            const response = await aiRef.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: quizSchema,
                },
            });

            const quizData = JSON.parse(response.text);
            setQuiz(quizData);
        } catch (e: any) {
            setError(`Quiz generation failed: ${JSON.stringify(e.message || e)}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuizAnswer = (option: string) => {
        if (isQuizCorrect) return; // Don't do anything if already answered correctly
        
        setSelectedQuizAnswer(option);

        if (option === quiz.answer) {
            setIsQuizCorrect(true);
            triggerConfetti();
            playSuccessSound();
        }
    };

    // --- Render ---
    return (
        <>
            <style>{STYLES}</style>
            <div className="container">
                <header>
                    <h1>Digi Français</h1>
                    <p>Your AI-powered language learning assistant</p>
                </header>

                <main>
                    <div className="controls">
                        <div className="button-group">
                            <button onClick={handleRefresh} className="refresh-button" aria-label="Clear and refresh">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                                </svg>
                            </button>
                             <button onClick={handleListen} className={`mic-button ${isListening ? 'listening' : ''}`} aria-label={isListening ? 'Stop listening' : 'Start listening'}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    {isListening 
                                        ? <path d="M6 6h12v12H6z" /> 
                                        : <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85l-.01.14c0 2.76-2.24 5-5 5s-5-2.24-5-5a1 1 0 0 0-1.99.14l.01.15c0 3.53 2.61 6.43 6 6.92V21h-2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.08c3.39-.49 6-3.39 6-6.92a1 1 0 0 0-1-1z"/>
                                    }
                                </svg>
                            </button>
                        </div>
                        <p className="status">
                            Status: {isListening ? 'Listening...' : isLoading ? 'Processing...' : 'Idle'}
                        </p>
                    </div>

                    {error && <div className="error-banner">{error}</div>}

                    <div className="translation-grid">
                        <div className="text-box">
                            <h2>You said (English)</h2>
                            <p className="content">{recognizedText || '...'}</p>
                        </div>
                        <div className="text-box">
                            <div className="translation-header">
                                <h2>Translation</h2>
                                <div className="translation-actions">
                                    <button 
                                        onClick={handlePlayTranslationAudio}
                                        disabled={!translatedText || isLoading || isGeneratingAudio}
                                        className={`audio-button ${isGeneratingAudio ? 'loading' : ''}`}
                                        aria-label="Play translated text"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                        </svg>
                                    </button>
                                    <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
                                        {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                </div>
                            </div>
                            <p className="content">
                                {isLoading && !translatedText ? 'Translating...' : translatedText || '...'}
                            </p>
                        </div>
                    </div>

                    <div className="quiz-section">
                        {(recognizedText || translatedText) && !quiz && (
                            <button onClick={handleGenerateQuiz} disabled={isLoading} className="quiz-button">
                                {isLoading ? 'Generating...' : '✨ Generate Quiz'}
                            </button>
                        )}
                        {quiz && (
                            <div className="quiz-container">
                                <h3>{quiz.question}</h3>
                                <div className="quiz-options">
                                    {quiz.options.map((option: string, index: number) => {
                                        const isSelected = selectedQuizAnswer === option;
                                        const isCorrect = quiz.answer === option;
                                        let className = 'quiz-option';
                                        if (isSelected) {
                                            className += isCorrect ? ' correct' : ' incorrect';
                                        }
                                        return (
                                            <button 
                                                key={index}
                                                className={className}
                                                onClick={() => handleQuizAnswer(option)}
                                                disabled={isQuizCorrect}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedQuizAnswer && !isQuizCorrect && (
                                    <p className={'quiz-feedback incorrect'}>
                                        Try again!
                                    </p>
                                )}
                                {isQuizCorrect && (
                                    <p className={'quiz-feedback correct'}>
                                        Correct! Well done!
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
};

// --- Styles ---
const STYLES = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @keyframes fall {
        to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
    :root {
        --bg-color: #f8f9fa;
        --card-bg: #ffffff;
        --text-color: #212529;
        --muted-text: #6c757d;
        --primary-color: #007bff;
        --primary-hover: #0056b3;
        --success-color: #28a745;
        --danger-color: #dc3545;
        --border-color: #dee2e6;
        --shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    body {
        margin: 0;
        font-family: 'Inter', sans-serif;
        background-color: var(--bg-color);
        color: var(--text-color);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        overflow-x: hidden; /* Prevent horizontal scrollbar from confetti */
    }
    .confetti {
        position: fixed;
        top: -10px;
        width: 10px;
        height: 10px;
        pointer-events: none;
        animation: fall linear forwards;
        z-index: 9999;
    }
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem 1.5rem;
    }
    header {
        text-align: center;
        margin-bottom: 2.5rem;
    }
    header h1 {
        font-size: 2.5rem;
        font-weight: 700;
        margin: 0 0 0.5rem 0;
    }
    header p {
        font-size: 1.1rem;
        color: var(--muted-text);
        margin: 0;
    }
    .controls {
        text-align: center;
        margin-bottom: 2rem;
    }
    .button-group {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
    }
    .mic-button {
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 50%;
        width: 64px;
        height: 64px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.2s ease, transform 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    }
    .mic-button:hover {
        background-color: var(--primary-hover);
        transform: scale(1.05);
    }
    .mic-button.listening {
        background-color: var(--danger-color);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
    }
    .refresh-button {
        background-color: #e9ecef;
        color: var(--muted-text);
        border: none;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }
    .refresh-button:hover {
        background-color: #ced4da;
        color: var(--text-color);
        transform: scale(1.05);
    }
    .status {
        margin-top: 0.75rem;
        color: var(--muted-text);
        font-size: 0.9rem;
        min-height: 1.2em; /* Prevent layout shift */
    }
    .error-banner {
        background-color: #fff3f3;
        color: var(--danger-color);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
        margin-bottom: 1.5rem;
        text-align: center;
    }
    .translation-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
    @media (min-width: 768px) {
        .translation-grid {
            grid-template-columns: 1fr 1fr;
        }
    }
    .text-box {
        background-color: var(--card-bg);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
    }
    .text-box h2 {
        font-size: 1rem;
        font-weight: 500;
        color: var(--muted-text);
        margin: 0 0 1rem 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .text-box .content {
        font-size: 1.1rem;
        min-height: 6em;
        margin: 0;
        line-height: 1.6;
        color: var(--text-color);
    }
    .translation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .translation-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .translation-header select {
        padding: 0.3rem 0.6rem;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        font-family: inherit;
        font-size: 0.9rem;
    }
    .audio-button {
        background: transparent;
        border: none;
        color: var(--muted-text);
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s, color 0.2s;
    }
    .audio-button:hover:not(:disabled) {
        background-color: #e9ecef;
        color: var(--text-color);
    }
    .audio-button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
    .audio-button.loading svg {
        display: none;
    }
    .audio-button.loading::after {
        content: '';
        display: block;
        width: 16px;
        height: 16px;
        border: 2px solid var(--primary-color);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    .quiz-section {
        margin-top: 2.5rem;
        text-align: center;
    }
    .quiz-button {
        background: linear-gradient(45deg, #6a11cb 0%, #2575fc 100%);
        color: white;
        border: none;
        padding: 0.8rem 1.5rem;
        font-size: 1rem;
        font-weight: 500;
        border-radius: 50px;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .quiz-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    }
    .quiz-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    .quiz-container {
        background-color: var(--card-bg);
        border-radius: 12px;
        padding: 2rem;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow);
        margin-top: 1.5rem;
        text-align: left;
    }
    .quiz-container h3 {
        margin: 0 0 1.5rem 0;
        font-size: 1.2rem;
    }
    .quiz-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .quiz-option {
        width: 100%;
        text-align: left;
        padding: 0.9rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background-color: transparent;
        color: var(--text-color); /* Fix: Ensure text is visible */
        cursor: pointer;
        transition: background-color 0.2s ease, border-color 0.2s ease;
        font-family: inherit;
        font-size: 1rem;
    }
    .quiz-option:hover:not(:disabled) {
        background-color: #f1f3f5;
        border-color: #adb5bd;
    }
    .quiz-option:disabled {
        cursor: not-allowed;
    }
    .quiz-option.correct {
        background-color: #e9f7ef;
        border-color: var(--success-color);
        color: #155724;
        font-weight: 500;
    }
    .quiz-option.incorrect {
        background-color: #f8d7da;
        border-color: var(--danger-color);
        color: #721c24;
        font-weight: 500;
    }
    .quiz-feedback {
        margin-top: 1rem;
        font-weight: 500;
        min-height: 1.2em; /* Prevent layout shift */
    }
    .quiz-feedback.correct {
        color: var(--success-color);
    }
    .quiz-feedback.incorrect {
        color: var(--danger-color);
    }
`;

// --- Render App ---
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
