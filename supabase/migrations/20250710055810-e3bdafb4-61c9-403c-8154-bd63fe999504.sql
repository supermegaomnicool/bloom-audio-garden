-- Create table for channel chat conversations
CREATE TABLE public.channel_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  saved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.channel_chats ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own channel chats" 
ON public.channel_chats 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own channel chats" 
ON public.channel_chats 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channel chats" 
ON public.channel_chats 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channel chats" 
ON public.channel_chats 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_channel_chats_updated_at
BEFORE UPDATE ON public.channel_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key reference to channels table
ALTER TABLE public.channel_chats 
ADD CONSTRAINT channel_chats_channel_id_fkey 
FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;