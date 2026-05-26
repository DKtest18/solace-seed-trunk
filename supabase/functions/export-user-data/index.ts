import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const { user, error } = await getAuthenticatedUser(req);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const svc = getServiceClient();
    const uid = user.id;

    // Collect data across categories (best-effort: missing tables are skipped)
    const tables: Array<{ name: string; query: any }> = [
      { name: 'profile', query: svc.from('dkai_profiles').select('*').eq('id', uid) },
      { name: 'products', query: svc.from('dkai_products').select('*').eq('seller_id', uid) },
      { name: 'orders_as_buyer', query: svc.from('dkai_orders').select('*').eq('buyer_id', uid) },
      { name: 'orders_as_seller', query: svc.from('dkai_orders').select('*').eq('seller_id', uid) },
      { name: 'reviews', query: svc.from('dkai_reviews').select('*').eq('reviewer_id', uid) },
      { name: 'messages', query: svc.from('dkai_messages').select('*').eq('sender_id', uid) },
      { name: 'custom_orders', query: svc.from('dkai_custom_orders').select('*').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`) },
      { name: 'waitlist', query: svc.from('dkai_waitlist').select('*').eq('user_id', uid) },
      { name: 'disputes', query: svc.from('dkai_disputes').select('*').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`) },
      { name: 'cookie_preferences', query: svc.from('dkai_profiles').select('cookie_preferences').eq('id', uid) },
    ];

    const zip = new JSZip();

    const manifest: Record<string, any> = {
      exported_at: new Date().toISOString(),
      gdpr_article: 'Art. 20 DSGVO / Art. 28 revDSG - Right to data portability',
      user: { id: uid, email: user.email },
      files: [],
    };

    for (const t of tables) {
      try {
        const { data, error: qErr } = await t.query;
        const content = qErr ? { error: qErr.message } : (data || []);
        zip.file(`${t.name}.json`, JSON.stringify(content, null, 2));
        manifest.files.push({ name: `${t.name}.json`, rows: Array.isArray(content) ? content.length : 0 });
      } catch (e) {
        zip.file(`${t.name}.json`, JSON.stringify({ error: String(e) }, null, 2));
      }
    }

    zip.file('MANIFEST.json', JSON.stringify(manifest, null, 2));
    zip.file('README.txt',
      `DK AI Marketplace - Personal Data Export\n` +
      `Exported: ${new Date().toISOString()}\n` +
      `User: ${user.email}\n\n` +
      `This archive contains your personal data as required by GDPR Art. 20 / revDSG Art. 28.\n` +
      `Each JSON file holds one category of data. Questions: dari@dkaisystem.com\n`
    );

    const zipBuf = await zip.generateAsync({ type: 'uint8array' });

    const filename = `export-${Date.now()}.zip`;
    const path = `${uid}/${filename}`;

    const { error: upErr } = await svc.storage
      .from('user-data-exports')
      .upload(path, zipBuf, { contentType: 'application/zip', upsert: true });
    if (upErr) return errorResponse(`Upload failed: ${upErr.message}`, 500);

    // 7-day signed URL
    const expiresInSec = 60 * 60 * 24 * 7;
    const { data: signed, error: sErr } = await svc.storage
      .from('user-data-exports')
      .createSignedUrl(path, expiresInSec);
    if (sErr || !signed) return errorResponse(`Signed URL failed: ${sErr?.message}`, 500);

    const expiryDate = new Date(Date.now() + expiresInSec * 1000).toLocaleDateString('en-US');

    // Notify
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'data_export_ready',
        recipientEmail: user.email,
        data: { downloadUrl: signed.signedUrl, expiryDate },
      }),
    }).catch(() => {});

    return jsonResponse({ success: true, downloadUrl: signed.signedUrl, expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString() });
  } catch (e: any) {
    return errorResponse(e?.message || 'Export failed', 500);
  }
});
