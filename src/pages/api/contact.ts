export const prerender = false;
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let email = '';
    let subject = '';
    let message = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      name = body.name || '';
      email = body.email || '';
      subject = body.subject || '';
      message = body.message || '';
    } else {
      const formData = await request.formData();
      name = formData.get('name')?.toString() || '';
      email = formData.get('email')?.toString() || '';
      subject = formData.get('subject')?.toString() || '';
      message = formData.get('message')?.toString() || '';
    }

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email and message are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In production this should:
    // 1. Store the message (e.g. D1 contact_messages table)
    // 2. Send a notification email via SMTP once credentials are configured
    // See .env SMTP_* vars.
    console.log(`Contact message from ${name} <${email}> [${subject || 'general'}]: ${message}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Thanks — we\'ll get back to you soon!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
