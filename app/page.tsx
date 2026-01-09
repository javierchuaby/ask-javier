"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleAskJavier = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "aiden", content: input };
    const updatedMessages = [...messages, userMsg]; // Local copy to send
    
    // Create streaming message immediately
    const streamingMsg: ChatMessage = { role: "javier", content: "" };
    
    // Add both user message and empty streaming message
    setMessages([...updatedMessages, streamingMsg]);
    setInput("");
    setIsLoading(true);

    const streamingIndex = updatedMessages.length; // Index of the streaming message

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }), // Send history
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and append to accumulated text
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Update the streaming message content
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[streamingIndex]) {
            newMessages[streamingIndex] = {
              ...newMessages[streamingIndex],
              content: accumulatedText,
            };
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
      // Update the streaming message with error message
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[streamingIndex]) {
          newMessages[streamingIndex] = {
            ...newMessages[streamingIndex],
            content: "I can't handle that yet—ask the real Javier.",
          };
        }
        return newMessages;
      });
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
                {msg.role === "javier" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="ml-2">{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-stone-100 text-stone-800 px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="bg-stone-100 border border-stone-300 rounded p-3 overflow-x-auto mb-2">
                          {children}
                        </pre>
                      ),
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-stone-300 pl-4 italic my-2">{children}</blockquote>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
            <p className="text-stone-400 animate-pulse">Javier is typing...</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="sticky bottom-8 bg-white p-2 rounded-xl shadow-2xl border border-stone-200 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskJavier()}
            placeholder="Type here..."
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
