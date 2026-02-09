import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiRequest {
  model: string;
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('trial_words_quota, trial_expires_at, custom_gemini_key')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user has custom API key
    let geminiApiKey: string;
    let usingCustomKey = false;

    if (profile.custom_gemini_key) {
      geminiApiKey = profile.custom_gemini_key;
      usingCustomKey = true;
    } else {
      // Use managed trial credits - check quota
      const { data: usageData } = await supabase
        .from('api_usage')
        .select('words_used')
        .eq('user_id', user.id);

      const totalWordsUsed =
        usageData?.reduce(
          (sum: number, record: { words_used: number }) => sum + record.words_used,
          0
        ) || 0;

      // Check trial expiration
      const expiresAt = profile.trial_expires_at ? new Date(profile.trial_expires_at) : null;
      const now = new Date();
      const trialExpired = expiresAt ? now > expiresAt : true;

      if (totalWordsUsed >= profile.trial_words_quota || trialExpired) {
        return new Response(
          JSON.stringify({
            error: 'Trial quota exceeded',
            message: trialExpired ? 'Trial period has expired' : 'Word quota exceeded',
            wordsUsed: totalWordsUsed,
            wordsQuota: profile.trial_words_quota,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Use the managed Gemini API key from environment
      geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
      if (!geminiApiKey) {
        return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Parse request body
    const body = (await req.json()) as GeminiRequest;
    const { model, contents, generationConfig } = body;

    if (!model || !contents) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward request to Gemini API
    const geminiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${geminiApiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig,
      }),
    });

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return new Response(JSON.stringify({ error: 'Gemini API error', details: geminiData }), {
        status: geminiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate word count from response
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const wordsUsed = responseText.split(/\s+/).length;
    const tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;

    // Record usage if using trial credits
    if (!usingCustomKey) {
      await supabase.from('api_usage').insert({
        user_id: user.id,
        provider: 'gemini',
        model,
        words_used: wordsUsed,
        tokens_used: tokensUsed,
        cost: 0, // Free trial
      });
    }

    // Return the response
    return new Response(JSON.stringify(geminiData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
