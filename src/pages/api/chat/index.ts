export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import {
  createConversation,
  getUserConversations,
  createMessage,
  getConversationMessages,
  searchDocuments,
} from '../../../lib/dev-store';

function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value;
  if (!token) return null;
  const result = devGetSession(token);
  return result?.session?.user || null;
}

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY || '';

const SYSTEM_PROMPT = `You are NotesChatAI, an AI study assistant with access to the user's personal knowledge base.
Answer questions based ONLY on the provided context from their documents.
Always cite your sources using [Source: document_title] format.
If the context doesn't contain enough information, say so honestly.
Be concise but thorough. Use markdown for formatting.`;

// GET /api/chat — list conversations
export const GET: APIRoute = async ({ cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const convs = getUserConversations(user.id);
  return new Response(JSON.stringify({ conversations: convs }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST /api/chat — send a message and stream response
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { message, conversationId, model = 'gemini-1.5-flash' } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
  }

  // Get or create conversation
  let convId = conversationId;
  let convTitle = message.slice(0, 60);

  if (!convId) {
    const conv = createConversation(user.id, convTitle, model);
    convId = conv.id;
  }

  // Save user message
  createMessage(convId, 'user', message, model);

  // RAG: search user's documents for context
  const searchResults = searchDocuments(user.id, message);
  const context = searchResults.length > 0
    ? searchResults.map((r, i) => `[${i + 1}] ${r.chunk}`).join('\n\n')
    : 'No relevant documents found in the knowledge base.';

  const citations = searchResults.map(r => ({ title: r.doc.title, score: r.score }));

  // Build messages for Gemini
  const geminiMessages = [
    { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nContext from knowledge base:\n${context}\n\nUser question: ${message}` }] },
  ];

  // Save assistant message placeholder
  const assistantMsg = createMessage(convId, 'assistant', '', model, JSON.stringify(citations));

  // If no Gemini API key, return a helpful response explaining the situation
  if (!GEMINI_API_KEY) {
    const fallbackResponse = generateFallbackResponse(message, searchResults);
    assistantMsg.content = fallbackResponse;
    return new Response(JSON.stringify({
      message: fallbackResponse,
      conversationId: convId,
      messageId: assistantMsg.id,
      citations,
      model: 'fallback',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Call Gemini API with streaming
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      const errorMsg = 'I apologize, but I encountered an error connecting to the AI service. Please check your GEMINI_API_KEY configuration and try again.';
      assistantMsg.content = errorMsg;
      return new Response(JSON.stringify({
        message: errorMsg,
        conversationId: convId,
        messageId: assistantMsg.id,
        citations,
        error: true,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (text) {
                    fullContent += text;
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }
          }

          // Save the full response
          assistantMsg.content = fullContent;

          // Send final event with metadata
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
            done: true,
            conversationId: convId,
            messageId: assistantMsg.id,
            citations,
          })}\n\n`));

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': convId,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    const errorMsg = 'Something went wrong. Please try again.';
    assistantMsg.content = errorMsg;
    return new Response(JSON.stringify({
      message: errorMsg,
      conversationId: convId,
      messageId: assistantMsg.id,
      citations,
      error: true,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function generateFallbackResponse(message: string, searchResults: Array<{ doc: { title: string }; chunk: string }>): string {
  const lower = message.toLowerCase();

  if (searchResults.length === 0) {
    return `I received your question: "${message}"\n\n⚠️ **No documents in your knowledge base yet.**\n\nTo get real answers from your documents:\n1. Go to **Documents** and upload a PDF, EPUB, or other file\n2. Wait for processing to complete\n3. Come back and ask your question again\n\nI'll then search through your documents and provide answers with citations.`;
  }

  const sources = searchResults.map(r => `- **${r.doc.title}**`).join('\n');

  if (lower.includes('summarize') || lower.includes('summary')) {
    return `Based on your documents, here's a summary:\n\n${searchResults.map(r => r.chunk).join('\n\n---\n\n')}\n\n---\n**Sources:**\n${sources}\n\n*Note: I'm running in local dev mode without a Gemini API key. Add GEMINI_API_KEY to your .env file for full AI-powered responses.*`;
  }

  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how')) {
    return `Based on your documents, here's what I found:\n\n${searchResults.map(r => r.chunk).join('\n\n---\n\n')}\n\n---\n**Sources:**\n${sources}\n\n*Note: I'm running in local dev mode without a Gemini API key. Add GEMINI_API_KEY to your .env file for full AI-powered responses.*`;
  }

  return `Here's what I found in your knowledge base related to "${message}":\n\n${searchResults.map(r => r.chunk).join('\n\n---\n\n')}\n\n---\n**Sources:**\n${sources}\n\n*Note: I'm running in local dev mode without a Gemini API key. Add GEMINI_API_KEY to your .env file for full AI-powered responses.*`;
}
