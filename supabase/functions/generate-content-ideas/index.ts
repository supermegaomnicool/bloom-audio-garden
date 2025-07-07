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
    const { episodeId, episodeTitle, episodeDescription, transcript, channelName } = await req.json();

    if (!episodeId || !episodeTitle) {
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

    // First, get industry trends using web search (simplified approach)
    let industryContext = '';
    try {
      // We'll simulate web search results with common industry trends
      // In a real implementation, you'd use a web search API
      const industryKeywords = extractIndustryKeywords(episodeTitle, episodeDescription || '', channelName);
      industryContext = `Current trending topics in ${industryKeywords.join(', ')} industry: 
        - AI and automation trends
        - Sustainability and eco-friendly practices
        - Remote work and digital transformation
        - Mental health and wellness focus
        - Social media marketing evolution
        - Customer experience optimization
        - Data privacy and security concerns
        - Emerging technology adoption`;
    } catch (error) {
      console.log('Could not fetch industry trends, proceeding without:', error);
    }

    // Prepare content for AI analysis
    let contentSummary = `Episode: "${episodeTitle}" from "${channelName}"`;
    if (episodeDescription) {
      contentSummary += `\nDescription: ${episodeDescription.substring(0, 800)}`;
    }
    if (transcript) {
      contentSummary += `\nContent highlights: ${transcript.substring(0, 1500)}`;
    }

    const systemPrompt = `You are an expert content strategist and trend analyst. Generate content ideas that fill gaps and leverage trending topics for podcast episodes.

Your task is to analyze the provided episode content and suggest new content ideas that:
1. Complement the existing content without duplicating it
2. Leverage current industry trends and popular topics
3. Would appeal to the same audience
4. Are specific and actionable

Format your response as exactly 5 content ideas, each as a complete paragraph (2-4 sentences) that includes:
- A compelling hook or angle
- Specific talking points or elements to cover
- Why it's timely/trending
- How it connects to the channel's audience

Make each idea distinct and valuable. Include bullet points within paragraphs where helpful for specific elements or tips.`;

    const userPrompt = `${contentSummary}

${industryContext}

Based on this episode content and current industry trends, suggest 5 new content ideas that would complement this episode and appeal to the same audience. Each idea should be a full paragraph with specific details, potential talking points (as bullet points within the paragraph), and explain why it's relevant right now.

Focus on content gaps - what related topics haven't been covered that the audience would find valuable? Consider trending themes, common questions, and emerging topics in the industry.

Return only the 5 content ideas as a JSON array of strings, with no additional text or formatting.`;

    // Generate ideas using OpenAI
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
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    
    let ideas;
    try {
      // Clean the response text by removing markdown code blocks
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      ideas = JSON.parse(cleanedText);
      if (!Array.isArray(ideas) || ideas.length === 0) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      // Fallback: extract ideas from text
      ideas = generatedText.split('\n\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 50) // Ensure substantial content
        .slice(0, 5);
    }

    // Save ideas to database
    const { data: savedIdeas, error: saveError } = await supabase
      .from('content_ideas')
      .upsert({
        episode_id: episodeId,
        user_id: userData.user.id,
        channel_name: channelName,
        episode_title: episodeTitle,
        generated_ideas: ideas
      }, { 
        onConflict: 'episode_id,user_id',
        returning: 'minimal'
      });

    if (saveError) {
      console.error('Error saving content ideas:', saveError);
      // Continue anyway - return ideas even if save fails
    }

    return new Response(JSON.stringify({ 
      ideas,
      saved: !saveError 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-content-ideas function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      ideas: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to extract industry keywords from content
function extractIndustryKeywords(title: string, description: string, channelName: string): string[] {
  const content = `${title} ${description} ${channelName}`.toLowerCase();
  
  const industryKeywords = [
    'technology', 'business', 'marketing', 'finance', 'health', 'fitness',
    'education', 'entertainment', 'science', 'startup', 'entrepreneurship',
    'design', 'productivity', 'leadership', 'sales', 'customer service',
    'digital', 'social media', 'content', 'personal development', 'career'
  ];
  
  const found = industryKeywords.filter(keyword => content.includes(keyword));
  return found.length > 0 ? found : ['general business'];
}