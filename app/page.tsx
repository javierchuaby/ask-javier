"use client";

import { useState, useRef, useEffect } from "react";

// We define what a 'Message' looks like
interface ChatMessage {
  role: "aiden" | "javier";
  content: string;
}

export default function Home() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleAskJavier = async () => {
    if (!input.trim()) return;

    // 1. Add user message to the UI immediately
    const userMsg: ChatMessage = { role: "aiden", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // 2. Call your route.ts API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      // 3. Add Javier's response to the UI
      const javierMsg: ChatMessage = { role: "javier", content: data.text };
      setMessages((prev) => [...prev, javierMsg]);
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 py-12 px-4 font-serif">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-stone-900 mb-2">Ask Javier</h1>
          <p className="text-stone-600 italic">For Aiden Lei Lopez</p>
        </header>

        {/* Chat History Area */}
        <div className="space-y-6 mb-8 min-h-[300px] max-h-[60vh] overflow-y-auto">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === "aiden" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] p-4 rounded-lg shadow-sm ${
                msg.role === "aiden" 
                ? "bg-stone-800 text-stone-100 rounded-br-none" 
                : "bg-white border border-stone-200 text-stone-800 rounded-bl-none italic"
              }`}>
                <span className="block text-xs uppercase tracking-widest mb-1 opacity-50">
                  {msg.role === "aiden" ? "AIDEN" : "JAVIER"}
                </span>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && <p className="text-stone-400 animate-pulse">Javier is typing gracefully...</p>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="sticky bottom-8 bg-white p-2 rounded-xl shadow-2xl border border-stone-200 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskJavier()}
            placeholder="Address the butler..."
            className="flex-1 p-3 focus:outline-none text-stone-800"
          />
          <button
            onClick={handleAskJavier}
            disabled={isLoading}
            className="bg-stone-900 text-white px-6 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:bg-stone-300"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
