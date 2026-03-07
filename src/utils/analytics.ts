import { db } from '@/lib/dkaiDb';

export async function trackProductView(productId: string, userId?: string) {
  try {
    const sessionId = getSessionId();
    await db.from('dkai_product_analytics').insert({ product_id: productId, event_type: 'view', user_id: userId || null, session_id: sessionId });
  } catch (error) {
    console.error('Error tracking view:', error);
  }
}

export async function trackProductClick(productId: string, userId?: string) {
  try {
    const sessionId = getSessionId();
    await db.from('dkai_product_analytics').insert({ product_id: productId, event_type: 'click', user_id: userId || null, session_id: sessionId });
  } catch (error) {
    console.error('Error tracking click:', error);
  }
}

export async function trackPurchase(productId: string, userId?: string) {
  try {
    const sessionId = getSessionId();
    await db.from('dkai_product_analytics').insert({ product_id: productId, event_type: 'purchase', user_id: userId || null, session_id: sessionId });
  } catch (error) {
    console.error('Error tracking purchase:', error);
  }
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}
