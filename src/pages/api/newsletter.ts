export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: { Location: '/blog' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type');
    let email: string;

    if (contentType?.includes('application/json')) {
      const body = await request.json();
      email = body.email;
    } else {
      const formData = await request.formData();
      email = formData.get('email')?.toString() || '';
    }

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // In production, would:
    // 1. Validate email format
    // 2. Check for duplicates
    // 3. Store in database (D1)
    // 4. Send confirmation email
    // 5. Subscribe to mailing list (ConvertKit, Mailchimp, etc.)

    console.log(`Newsletter signup: ${email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Thanks for subscribing!' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Newsletter signup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};