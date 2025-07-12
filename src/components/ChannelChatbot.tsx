import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Save, Loader2, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ChatMessage {
  id: string;
  question: string;
  response: string;
  saved: boolean;
  created_at: string;
}

interface ChannelChatbotProps {
  channelId: string;
  channelName: string;
}

export const ChannelChatbot = ({ channelId, channelName }: ChannelChatbotProps) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadChatHistory();
  }, [channelId]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('channel_chats')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const currentQuestion = question.trim();
    setQuestion("");
    setLoading(true);

    try {
      console.log('Calling channel-chat function with:', { question: currentQuestion, channelId });
      
      const { data, error } = await supabase.functions.invoke('channel-chat', {
        body: {
          question: currentQuestion,
          channelId: channelId
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      // Add the new message to the list
      const newMessage: ChatMessage = {
        id: data.chatId,
        question: currentQuestion,
        response: data.response,
        saved: false,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, newMessage]);

    } catch (error) {
      console.error('Error asking question:', error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('channel_chats')
        .update({ saved: true })
        .eq('id', messageId);

      if (error) {
        throw error;
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, saved: true } : msg
        )
      );

      toast({
        title: "Saved",
        description: "Message saved successfully.",
      });

    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: "Error",
        description: "Failed to save message.",
        variant: "destructive",
      });
    }
  };

  if (loadingHistory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>Loading chat...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>Chat with {channelName}</span>
      </div>
      
      {messages.length > 0 && (
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <ScrollArea ref={scrollAreaRef} className="h-64 w-full">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-sm font-medium text-foreground mb-1">You asked:</div>
                      <div className="text-sm text-muted-foreground">{message.question}</div>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-foreground">Response:</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveMessage(message.id)}
                          disabled={message.saved}
                          className="h-6 px-2"
                        >
                          <Bookmark className={`h-3 w-3 ${message.saved ? 'fill-current' : ''}`} />
                          {message.saved ? 'Saved' : 'Save'}
                        </Button>
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap">{message.response}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this channel..."
          disabled={loading}
          className="flex-1"
        />
        <Button 
          type="submit" 
          disabled={loading || !question.trim()}
          size="sm"
          className="px-3"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
};