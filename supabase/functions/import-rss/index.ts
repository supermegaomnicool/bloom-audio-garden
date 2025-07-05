import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Episode {
  title: string;
  description: string;
  published_at: string;
  duration: string;
  audio_url: string;
  artwork_url: string;
  episode_number?: number;
  season_number?: number;
  file_size?: number;
  external_id: string;
}

interface Channel {
  name: string;
  description: string;
  artwork_url: string;
  url: string;
}

// Simple XML parsing function
function extractTextContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractAttribute(xml: string, tagName: string, attribute: string): string {
  const regex = new RegExp(`<${tagName}[^>]*${attribute}=["']([^"']*)["'][^>]*>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    items.push(match[0]);
  }
  
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rss_url, channel_id } = await req.json();
    
    if (!rss_url) {
      throw new Error('RSS URL is required');
    }

    console.log(`Starting RSS import for: ${rss_url}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch RSS feed
    const rssResponse = await fetch(rss_url);
    if (!rssResponse.ok) {
      throw new Error(`Failed to fetch RSS feed: ${rssResponse.statusText}`);
    }

    const rssText = await rssResponse.text();
    console.log('RSS feed fetched successfully');

    // Extract channel info using simple string parsing
    const channelInfo: Channel = {
      name: extractTextContent(rssText, 'title') || 'Unknown Podcast',
      description: extractTextContent(rssText, 'description') || '',
      artwork_url: extractAttribute(rssText, 'itunes:image', 'href') || extractTextContent(rssText, 'url') || '',
      url: rss_url
    };

    console.log(`Channel info extracted: ${channelInfo.name}`);

    // Download and store channel artwork
    let channelArtworkPath = '';
    if (channelInfo.artwork_url) {
      try {
        const artworkResponse = await fetch(channelInfo.artwork_url);
        if (artworkResponse.ok) {
          const artworkBlob = await artworkResponse.blob();
          const artworkBuffer = await artworkBlob.arrayBuffer();
          const fileExtension = channelInfo.artwork_url.split('.').pop()?.split('?')[0] || 'jpg';
          channelArtworkPath = `channels/${channel_id}/show-artwork.${fileExtension}`;
          
          const { error: uploadError } = await supabase.storage
            .from('episode-artwork')
            .upload(channelArtworkPath, artworkBuffer, {
              contentType: artworkBlob.type,
              upsert: true
            });

          if (uploadError) {
            console.error('Error uploading channel artwork:', uploadError);
          } else {
            console.log('Channel artwork uploaded successfully');
          }
        }
      } catch (error) {
        console.error('Error processing channel artwork:', error);
      }
    }

    // Update channel with artwork info
    const { error: channelUpdateError } = await supabase
      .from('channels')
      .update({
        name: channelInfo.name, // Update with official RSS name
        artwork_url: channelInfo.artwork_url,
        artwork_storage_path: channelArtworkPath,
        description: channelInfo.description, // Official RSS description
        last_imported_at: new Date().toISOString()
      })
      .eq('id', channel_id);

    if (channelUpdateError) {
      console.error('Error updating channel:', channelUpdateError);
    }

    // Extract episodes using simple parsing
    const itemsXml = extractAllItems(rssText);
    const episodes: Episode[] = [];

    console.log(`Found ${itemsXml.length} episodes to process`);

    for (const itemXml of itemsXml) {
      try {
        const title = extractTextContent(itemXml, 'title');
        if (!title) continue;

        const episode: Episode = {
          title: title,
          description: extractTextContent(itemXml, 'description') || '',
          published_at: extractTextContent(itemXml, 'pubDate') ? new Date(extractTextContent(itemXml, 'pubDate')).toISOString() : new Date().toISOString(),
          duration: extractTextContent(itemXml, 'itunes:duration') || '',
          audio_url: extractAttribute(itemXml, 'enclosure', 'url') || '',
          artwork_url: extractAttribute(itemXml, 'itunes:image', 'href') || '',
          episode_number: extractTextContent(itemXml, 'itunes:episode') ? parseInt(extractTextContent(itemXml, 'itunes:episode')) : undefined,
          season_number: extractTextContent(itemXml, 'itunes:season') ? parseInt(extractTextContent(itemXml, 'itunes:season')) : undefined,
          file_size: extractAttribute(itemXml, 'enclosure', 'length') ? parseInt(extractAttribute(itemXml, 'enclosure', 'length')) : undefined,
          external_id: extractTextContent(itemXml, 'guid') || `${channel_id}-${title}`
        };

        episodes.push(episode);
      } catch (error) {
        console.error('Error processing episode:', error);
      }
    }

    console.log(`Processed ${episodes.length} episodes`);

    // Debug: Log first few episodes
    if (episodes.length > 0) {
      console.log('Sample episodes:');
      episodes.slice(0, 2).forEach((ep, i) => {
        console.log(`Episode ${i + 1}:`, {
          title: ep.title,
          external_id: ep.external_id,
          audio_url: ep.audio_url,
          duration: ep.duration
        });
      });
    } else {
      console.log('No episodes found! Raw XML sample:', rssText.substring(0, 500));
    }

    // Store episodes in database
    let episodesProcessed = 0;
    for (const episode of episodes) {
      try {
        // Check if episode artwork is different from channel artwork
        const hasCustomArtwork = episode.artwork_url && episode.artwork_url !== channelInfo.artwork_url;
        
        let episodeArtworkPath = '';
        if (hasCustomArtwork && episode.artwork_url) {
          try {
            const artworkResponse = await fetch(episode.artwork_url);
            if (artworkResponse.ok) {
              const artworkBlob = await artworkResponse.blob();
              const artworkBuffer = await artworkBlob.arrayBuffer();
              const fileExtension = episode.artwork_url.split('.').pop()?.split('?')[0] || 'jpg';
              episodeArtworkPath = `channels/${channel_id}/episodes/${episode.external_id}.${fileExtension}`;
              
              const { error: uploadError } = await supabase.storage
                .from('episode-artwork')
                .upload(episodeArtworkPath, artworkBuffer, {
                  contentType: artworkBlob.type,
                  upsert: true
                });

              if (uploadError) {
                console.error('Error uploading episode artwork:', uploadError);
                episodeArtworkPath = '';
              }
            }
          } catch (error) {
            console.error('Error processing episode artwork:', error);
          }
        }

        // Insert or update episode
        const { error: episodeError } = await supabase
          .from('episodes')
          .upsert({
            title: episode.title,
            description: episode.description,
            published_at: episode.published_at,
            duration: episode.duration,
            audio_url: episode.audio_url,
            artwork_url: episode.artwork_url,
            artwork_storage_path: episodeArtworkPath,
            has_custom_artwork: hasCustomArtwork,
            episode_number: episode.episode_number,
            season_number: episode.season_number,
            external_id: episode.external_id,
            channel_id: channel_id,
            user_id: "00000000-0000-0000-0000-000000000000"
          }, {
            onConflict: 'external_id,channel_id'
          });

        if (episodeError) {
          console.error('Error inserting episode:', episodeError);
        } else {
          episodesProcessed++;
        }
      } catch (error) {
        console.error('Error processing episode:', error);
      }
    }

    // Update channel stats
    const { error: statsError } = await supabase
      .from('channels')
      .update({
        total_episodes: episodesProcessed,
        last_imported_at: new Date().toISOString()
      })
      .eq('id', channel_id);

    if (statsError) {
      console.error('Error updating channel stats:', statsError);
    }

    console.log(`Import completed: ${episodesProcessed} episodes processed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${episodesProcessed} episodes`,
        channel: channelInfo.name,
        episodes_processed: episodesProcessed,
        artwork_downloaded: episodesProcessed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('RSS import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});