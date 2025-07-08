import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, ideas, channelName, conversationHistory } = await req.json();

    if (!message || !ideas || !channelName) {
      throw new Error('Missing required parameters: message, ideas, and channelName');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Invalid user token');
    }

    // Prepare context about the content ideas
    const ideasContext = ideas.map((idea: string, index: number) => 
      `${index + 1}. ${idea}`
    ).join('\n\n');

    // Prepare conversation history for context
    const historyContext = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map((msg: any) => 
          `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n')
      : '';

    const systemPrompt = `You are an expert content strategist and podcast advisor helping creators optimize their content ideas. You have access to AI-generated content gap analysis for the podcast "${channelName}".

Your role is to:
1. Provide strategic insights about the content opportunities
2. Help prioritize which ideas to pursue first
3. Suggest implementation strategies and specific approaches
4. Identify trends and market opportunities
5. Help refine and expand on the generated ideas
6. Provide actionable next steps

Be conversational, insightful, and practical. Focus on helping the creator turn these opportunities into successful content.

CONTENT IDEAS FOR "${channelName}":
${ideasContext}

${historyContext ? `CONVERSATION HISTORY:\n${historyContext}\n` : ''}

Always reference specific ideas by their numbers when relevant, and provide concrete, actionable advice.`;

    const userPrompt = message;

    // Generate response using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      response: aiResponse 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-about-ideas function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I'm sorry, I'm having trouble responding right now. Please try again in a moment."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});