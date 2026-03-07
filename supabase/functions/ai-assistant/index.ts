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
    let systemPrompt = 'Du bist ein hilfreicher Assistent für den DK AI Marketplace – eine digitale Handelsplattform. Antworte auf Deutsch, es sei denn der Nutzer schreibt auf Englisch.';

    if (type === 'product_description') {
      prompt = `Erstelle eine ansprechende Produktbeschreibung für ein digitales Produkt mit dem Titel "${context.title}" vom Typ "${context.type}". ${context.purpose ? `Zweck: ${context.purpose}.` : ''} Halte es prägnant, professionell und ansprechend. Maximal 200 Wörter.`;
    } else if (type === 'chatbot') {
      systemPrompt = 'Du bist der DK AI Marketplace Assistent. Du hilfst Nutzern bei Fragen zu Kauf und Verkauf, Produkterstellung, Marktplatzregeln, Profileinstellungen, Meetings, Nachrichten und Community. Antworte freundlich und hilfsbereit. Antworte auf Deutsch, es sei denn der Nutzer schreibt auf Englisch.';
      prompt = context.message || 'Hallo';
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
