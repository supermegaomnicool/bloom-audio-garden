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
    const { episodeId, suggestionType, originalContent, episodeTitle, channelName, transcript, episodeDescription } = await req.json();

    if (!episodeId || !suggestionType) {
      throw new Error('Missing required parameters');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prompt = '';
    let systemPrompt = 'You are an expert podcast optimization specialist. Generate 5 alternative suggestions that are specific, actionable, and optimized for discoverability.';

    switch (suggestionType) {
      case 'title':
        systemPrompt = 'You are an expert podcast title writer. Create compelling, SEO-optimized titles that drive clicks and accurately represent the content.';
        if (transcript) {
          prompt = `Generate 5 alternative titles for this podcast episode from "${channelName}":

Original title: "${originalContent || episodeTitle}"
Episode content summary (from transcript): "${transcript.substring(0, 1500)}..."

Requirements:
- 30-80 characters optimal length
- Include compelling hooks, specific topics, or numbers when relevant
- Avoid generic words like "episode", "podcast", "show"
- Use specific topics/themes from the actual content
- Make them clickable and curiosity-driving
- Reference key insights, guests, or topics mentioned in the episode

Return only a JSON array of 5 title strings, no other text.`;
        } else {
          prompt = `Generate 5 alternative titles for this podcast episode from "${channelName}":

Original title: "${originalContent || episodeTitle}"
${episodeDescription ? `Episode description: "${episodeDescription.substring(0, 800)}..."` : ''}

Requirements:
- 30-80 characters optimal length
- Include compelling hooks or numbers when relevant
- Avoid generic words like "episode", "podcast", "show"
- Make them specific and clickable
- Maintain the core topic but make it more engaging

Return only a JSON array of 5 title strings, no other text.`;
        }
        break;

      case 'description':
        systemPrompt = 'You are an expert podcast description writer. Create detailed, SEO-rich descriptions that hook readers and provide value.';
        if (transcript) {
          prompt = `Generate 5 alternative opening paragraphs for this podcast episode description:

Episode: "${episodeTitle}" from "${channelName}"
Current description start: "${(originalContent || episodeDescription || '').substring(0, 500)}..."
Episode content (from transcript): "${transcript.substring(0, 2000)}..."

Requirements:
- Create compelling opening hooks using specific details from the episode content
- Avoid generic openings like "In this episode" or "Today we discuss"
- Start with intrigue, bold statements, specific insights, or immediate value
- Each should be 2-3 sentences that reference actual content discussed
- Use specific quotes, topics, or revelations from the transcript
- Make them irresistible to click and listen

Return only a JSON array of 5 opening paragraph strings, no other text.`;
        } else {
          prompt = `Generate 5 alternative opening paragraphs for this podcast episode description:

Episode: "${episodeTitle}" from "${channelName}"
Current description start: "${(originalContent || episodeDescription || '').substring(0, 500)}..."

Requirements:
- Create compelling opening hooks that grab attention immediately
- Avoid generic openings like "In this episode" or "Today we discuss"
- Start with intrigue, bold statements, or immediate value
- Each should be 2-3 sentences that make people want to listen
- Make them specific to the content, not generic

Return only a JSON array of 5 opening paragraph strings, no other text.`;
        }
        break;

      case 'hook':
        systemPrompt = 'You are an expert copywriter specializing in compelling opening hooks for podcast descriptions.';
        if (transcript) {
          prompt = `Generate 5 alternative opening sentences for this podcast description:

Episode: "${episodeTitle}" from "${channelName}"
Current opening: "${originalContent}"
Episode content (from transcript): "${transcript.substring(0, 1500)}..."

Requirements:
- Start with immediate intrigue using specific details from the episode
- Reference actual insights, quotes, or surprising moments from the content
- Avoid filler words and generic podcast language
- Make each opening grab attention in the first 10 words
- Use specific, concrete details from the transcript
- Create curiosity about what's revealed in the episode

Return only a JSON array of 5 opening sentence strings, no other text.`;
        } else {
          prompt = `Generate 5 alternative opening sentences for this podcast description:

Episode: "${episodeTitle}" from "${channelName}"
Current opening: "${originalContent}"
${episodeDescription ? `Episode description: "${episodeDescription.substring(0, 500)}..."` : ''}

Requirements:
- Start with immediate intrigue or value proposition
- Avoid filler words and generic podcast language
- Make each opening grab attention in the first 10 words
- Use specific, concrete language
- Create curiosity or promise immediate value

Return only a JSON array of 5 opening sentence strings, no other text.`;
        }
        break;

      default:
        throw new Error('Invalid suggestion type');
    }

    // Generate suggestions using OpenAI
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
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    
    let suggestions;
    try {
      // Clean the response text by removing markdown code blocks
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      suggestions = JSON.parse(cleanedText);
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      // Fallback: try to extract suggestions from text, excluding markdown markers
      suggestions = generatedText.split('\n')
        .filter(line => line.trim().length > 0)
        .filter(line => !line.trim().startsWith('```') && !line.trim().startsWith('[') && !line.trim().startsWith(']'))
        .slice(0, 5)
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').replace(/^["']|["']$/g, '').trim())
        .filter(line => line.length > 0);
    }

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

    // Save suggestions to database
    const { data: savedSuggestion, error: saveError } = await supabase
      .from('episode_suggestions')
      .upsert({
        episode_id: episodeId,
        user_id: userData.user.id,
        suggestion_type: suggestionType,
        original_content: originalContent,
        ai_suggestions: suggestions
      }, { 
        onConflict: 'episode_id,user_id,suggestion_type',
        returning: 'minimal'
      });

    if (saveError) {
      console.error('Error saving suggestions:', saveError);
      // Continue anyway - return suggestions even if save fails
    }

    return new Response(JSON.stringify({ 
      suggestions,
      saved: !saveError 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-suggestions function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      suggestions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});