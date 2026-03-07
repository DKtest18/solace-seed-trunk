import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { type, context } = await req.json();
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return errorResponse('Anthropic API key not configured', 500);

    let prompt = '';
    let systemPrompt = 'You are a helpful assistant for the DK AI Marketplace – a digital trading platform. Always respond in English by default.';

    if (type === 'product_description') {
      prompt = `Generate a compelling product description for a digital product titled "${context.title}" of type "${context.type}". ${context.purpose ? `Purpose: ${context.purpose}.` : ''} Keep it concise, professional, and engaging. Max 200 words.`;
    } else if (type === 'chatbot') {
      systemPrompt = 'You are the DK AI Marketplace Assistant. You help users with buying and selling, product creation, marketplace rules, profile settings, meetings, messaging, and community. Be friendly and helpful. Always respond in English by default.';
      prompt = context.message || 'Hello';
    } else {
      return errorResponse('Unknown AI assistant type');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return errorResponse('AI service error', 500);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return jsonResponse({ content });
  } catch (err) {
    console.error('AI assistant error:', err);
    return errorResponse(err.message, 500);
  }
});
