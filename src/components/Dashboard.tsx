import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Youtube, Video, AudioWaveform, Users, TrendingUp, Calendar, LogOut, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@/assets/hero-fantasy-forest.jpg";
import { ChannelList, ChannelListRef } from "./ChannelList";
import { AddChannelDialog } from "./AddChannelDialog";

export const Dashboard = () => {
  const navigate = useNavigate();
  const [showAddChannel, setShowAddChannel] = useState(false);
  const { user, signOut } = useAuth();
  const channelListRef = useRef<ChannelListRef>(null);
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChannelAdded = () => {
    // Refresh the channel list when a new channel is added
    if (channelListRef.current) {
      channelListRef.current.refreshChannels();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">RSS Project</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div 
        className="relative h-64 bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/60" />
        <div className="relative text-center max-w-4xl mx-auto px-6">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-foreground">
            Transform Your Podcasts
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your podcasts with magical AI-powered insights. Transmute ordinary content into extraordinary experiences.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-soft border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Start by adding your first channel</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Episodes Analyzed</CardTitle>
              <AudioWaveform className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Content waiting to be optimized</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Optimization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Performance score</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Import</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Never</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Channel List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Your Channels</h2>
                <p className="text-muted-foreground">Manage and optimize your content channels</p>
              </div>
              <Button 
                onClick={() => setShowAddChannel(true)}
                variant="nature"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Channel
              </Button>
            </div>
            <ChannelList ref={channelListRef} />
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="shadow-natural border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AudioWaveform className="h-5 w-5 text-primary" />
                  Quick Start
                </CardTitle>
                <CardDescription>
                  Get started with your content optimization journey
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => navigate("/optimize")}
                  variant="bloom" 
                  className="w-full justify-start"
                >
                  🎯 Optimize All Episodes
                </Button>
                <Button 
                  onClick={() => setShowAddChannel(true)}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <Youtube className="h-4 w-4 mr-2" />
                  Add YouTube Channel
                </Button>
                <Button 
                  onClick={() => setShowAddChannel(true)}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Add Podcast RSS
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-natural border-border/50">
              <CardHeader>
                <CardTitle>Optimization Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-1">SEO</Badge>
                  <div>
                    <p className="text-sm font-medium">Title Hooks</p>
                    <p className="text-xs text-muted-foreground">Use compelling questions and numbers</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-1">Notes</Badge>
                  <div>
                    <p className="text-sm font-medium">First Line Impact</p>
                    <p className="text-xs text-muted-foreground">Make the opening line count - no fluff</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AddChannelDialog 
        open={showAddChannel} 
        onOpenChange={setShowAddChannel}
        onChannelAdded={handleChannelAdded}
      />
    </div>
  );
};