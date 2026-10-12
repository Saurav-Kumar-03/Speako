import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import useAuthUser from '../hooks/useAuthUser';
import { Channel, ChannelHeader, Chat, MessageInput, MessageList, Window } from 'stream-chat-react';
import toast from 'react-hot-toast';
import ChatLoader from '../components/ChatLoader';
import CallButton from '../components/CallButton';
import { useNotifications } from '../context/NotificationContext';

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const { authUser } = useAuthUser();
  const { chatClient, isChatReady, setActiveChatUserId } = useNotifications();

  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set active chat user to suppress toast notifications for this conversation
  useEffect(() => {
    if (targetUserId) {
      setActiveChatUserId(targetUserId);
    }
    return () => {
      setActiveChatUserId(null);
    };
  }, [targetUserId, setActiveChatUserId]);

  useEffect(() => {
    const initChannel = async () => {
      if (!chatClient || !isChatReady || !authUser || !targetUserId) return;

      try {
        setLoading(true);
        const channelId = [authUser._id, targetUserId].sort().join("_");

        const currChannel = chatClient.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });

        await currChannel.watch();
        await currChannel.markRead();

        setChannel(currChannel);
      } catch (error) {
        console.error("Error watching stream channel:", error);
        toast.error("Could not load conversation. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initChannel();
  }, [chatClient, isChatReady, authUser, targetUserId]);

      const handleVideoCall=()=>{
           if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;

      channel.sendMessage({
        text: `I've started a video call. Join me here: ${callUrl}`,
      });

      toast.success("Video call link sent successfully!");
    }
      }

      if(loading || !chatClient ||!channel) return <ChatLoader/>
  return (
    <div className='h-[90vh]'>
      <Chat client={chatClient}>
          <Channel channel={channel}>
              <div className='w-full relative '>
                <CallButton handleVideoCall={handleVideoCall}/>
                  <Window>
                    <ChannelHeader/>
                      <MessageList/>
                      <MessageInput focus/>
                   
                  </Window>
              </div>
          </Channel>
      </Chat>
    </div>
  )
}

export default ChatPage;
