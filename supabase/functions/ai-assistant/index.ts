import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { type, context } = await req.json();
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return errorResponse('OpenAI API key not configured', 500);

    let prompt = '';
    if (type === 'product_description') {
      prompt = `Generate a compelling product description for a digital product titled "${context.title}" of type "${context.type}". ${context.purpose ? `Purpose: ${context.purpose}.` : ''} Keep it concise, professional, and engaging. Max 200 words.`;
    } else if (type === 'chatbot') {
      prompt = context.message || 'Hello';
    } else {
      return errorResponse('Unknown AI assistant type');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant for a digital marketplace platform called DK AI Marketplace.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return jsonResponse({ content });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
