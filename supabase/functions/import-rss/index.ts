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

    // Parse RSS XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(rssText, 'text/xml');
    
    if (!doc) {
      throw new Error('Failed to parse RSS XML');
    }

    // Extract channel info
    const channelElement = doc.querySelector('channel');
    if (!channelElement) {
      throw new Error('Invalid RSS feed: no channel element found');
    }

    const channelInfo: Channel = {
      name: channelElement.querySelector('title')?.textContent?.trim() || 'Unknown Podcast',
      description: channelElement.querySelector('description')?.textContent?.trim() || '',
      artwork_url: channelElement.querySelector('image url')?.textContent?.trim() || 
                   channelElement.querySelector('itunes\\:image')?.getAttribute('href') || '',
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
        artwork_url: channelInfo.artwork_url,
        artwork_storage_path: channelArtworkPath,
        description: channelInfo.description,
        last_imported_at: new Date().toISOString()
      })
      .eq('id', channel_id);

    if (channelUpdateError) {
      console.error('Error updating channel:', channelUpdateError);
    }

    // Extract episodes
    const items = doc.querySelectorAll('item');
    const episodes: Episode[] = [];

    console.log(`Found ${items.length} episodes to process`);

    for (const item of items) {
      try {
        const titleElement = item.querySelector('title');
        const descriptionElement = item.querySelector('description');
        const pubDateElement = item.querySelector('pubDate');
        const enclosureElement = item.querySelector('enclosure');
        const durationElement = item.querySelector('itunes\\:duration');
        const episodeElement = item.querySelector('itunes\\:episode');
        const seasonElement = item.querySelector('itunes\\:season');
        const guidElement = item.querySelector('guid');
        const itunesImageElement = item.querySelector('itunes\\:image');

        if (!titleElement?.textContent) continue;

        const episode: Episode = {
          title: titleElement.textContent.trim(),
          description: descriptionElement?.textContent?.trim() || '',
          published_at: pubDateElement?.textContent ? new Date(pubDateElement.textContent).toISOString() : new Date().toISOString(),
          duration: durationElement?.textContent?.trim() || '',
          audio_url: enclosureElement?.getAttribute('url') || '',
          artwork_url: itunesImageElement?.getAttribute('href') || '',
          episode_number: episodeElement?.textContent ? parseInt(episodeElement.textContent) : undefined,
          season_number: seasonElement?.textContent ? parseInt(seasonElement.textContent) : undefined,
          file_size: enclosureElement?.getAttribute('length') ? parseInt(enclosureElement.getAttribute('length')!) : undefined,
          external_id: guidElement?.textContent?.trim() || `${channel_id}-${titleElement.textContent.trim()}`
        };

        episodes.push(episode);
      } catch (error) {
        console.error('Error processing episode:', error);
      }
    }

    console.log(`Processed ${episodes.length} episodes`);

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

        // Get user_id from channel
        const { data: channelData } = await supabase
          .from('channels')
          .select('user_id')
          .eq('id', channel_id)
          .single();

        if (!channelData) {
          throw new Error('Channel not found');
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
            user_id: channelData.user_id
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