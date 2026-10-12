import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser";
import { getStreamToken, getFriendRequests } from "../lib/api";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();

  const [chatClient, setChatClient] = useState(null);
  const [isChatReady, setIsChatReady] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadChannels, setUnreadChannels] = useState([]);
  const [activeChatUserId, setActiveChatUserId] = useState(null);

  // Ref to hold activeChatUserId synchronously inside event callbacks
  const activeChatUserIdRef = useRef(activeChatUserId);
  activeChatUserIdRef.current = activeChatUserId;

  // Tracking for friend request deduplication
  const isInitialLoad = useRef(true);
  const seenRequestIds = useRef(new Set());

  // 1. Fetch Stream token for authenticated & onboarded user
  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser && !!authUser.isOnboarded,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Helper to query channels with unread messages
  const fetchUnreadChannels = useCallback(async (clientInstance) => {
    if (!clientInstance || !authUser?._id) return;
    try {
      const filter = { members: { $in: [authUser._id] } };
      const sort = [{ last_message_at: -1 }];
      const channels = await clientInstance.queryChannels(filter, sort, {
        watch: true,
        state: true,
        limit: 30,
      });

      const unread = channels.filter((c) => c.countUnread() > 0);
      setUnreadChannels(unread);
    } catch (err) {
      console.error("Error fetching unread channels:", err);
    }
  }, [authUser?._id]);

  // 2. Global Stream Client lifecycle (connect on login, disconnect on logout)
  useEffect(() => {
    let client = null;
    let isSubscribed = true;

    const initGlobalChat = async () => {
      if (!authUser || !authUser.isOnboarded || !tokenData?.token || !STREAM_API_KEY) {
        return;
      }

      try {
        client = StreamChat.getInstance(STREAM_API_KEY);

        // Connect user only if not already connected as this user
        if (client.userID !== authUser._id) {
          if (client.userID) {
            await client.disconnectUser();
          }

          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic || "/p7.png",
            },
            tokenData.token
          );
        }

        if (!isSubscribed) return;

        setChatClient(client);
        setIsChatReady(true);
        setUnreadMessageCount(client.user?.total_unread_count || 0);
        await fetchUnreadChannels(client);

        // Event listener: incoming message
        const handleNewMessage = (event) => {
          // Ignore own messages
          if (event.user?.id === authUser._id) return;

          setUnreadMessageCount(client.user?.total_unread_count || 0);
          fetchUnreadChannels(client);

          // Check if user is actively chatting with the sender
          const senderId = event.user?.id;
          if (senderId && activeChatUserIdRef.current === senderId) {
            return; // Suppress toast if active in that conversation
          }

          // Visual-only toast notification
          const senderName = event.user?.name || event.user?.fullName || "A user";
          const senderAvatar = event.user?.image || event.user?.profilePic || "/p7.png";
          const messageText = event.message?.text || "Sent you a message";
          const previewText = messageText.length > 55 ? messageText.substring(0, 52) + "..." : messageText;

          toast.custom(
            (t) => (
              <div
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate(`/chat/${senderId}`);
                }}
                className={`cursor-pointer max-w-sm w-full bg-base-100 border border-primary/40 shadow-2xl rounded-xl p-3 flex items-center gap-3 transition-all hover:scale-[1.02] ${
                  t.visible ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="avatar size-10 rounded-full overflow-hidden border border-primary/30 shrink-0">
                  <img
                    src={senderAvatar}
                    alt={senderName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/p7.png";
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs text-primary truncate">Message from {senderName}</p>
                  <p className="text-xs text-base-content/80 truncate mt-0.5">{previewText}</p>
                </div>
              </div>
            ),
            { duration: 4000, id: `msg_${event.message?.id || Date.now()}` }
          );
        };

        // Event listener: mark read
        const handleReadState = () => {
          setUnreadMessageCount(client.user?.total_unread_count || 0);
          fetchUnreadChannels(client);
        };

        // Event listener: connection recovered
        const handleReconnected = () => {
          setUnreadMessageCount(client.user?.total_unread_count || 0);
          fetchUnreadChannels(client);
        };

        client.on("message.new", handleNewMessage);
        client.on("notification.message_new", handleNewMessage);
        client.on("message.read", handleReadState);
        client.on("notification.mark_read", handleReadState);
        client.on("connection.recovered", handleReconnected);
      } catch (error) {
        console.error("Error in global Stream connection:", error);
      }
    };

    initGlobalChat();

    return () => {
      isSubscribed = false;
      if (client) {
        client.off("message.new");
        client.off("notification.message_new");
        client.off("message.read");
        client.off("notification.mark_read");
        client.off("connection.recovered");
      }
    };
  }, [authUser?._id, authUser?.isOnboarded, tokenData?.token, fetchUnreadChannels, navigate]);

  // Clean disconnect on logout
  useEffect(() => {
    if (!authUser && chatClient) {
      chatClient.disconnectUser().catch(console.error);
      setChatClient(null);
      setIsChatReady(false);
      setUnreadMessageCount(0);
      setUnreadChannels([]);
      isInitialLoad.current = true;
      seenRequestIds.current.clear();
    }
  }, [authUser, chatClient]);

  // 3. Friend Requests polling (12s interval, stops in background)
  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: !!authUser && !!authUser.isOnboarded,
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!friendRequests?.incomingReqs) return;
    const incoming = friendRequests.incomingReqs;
    const incomingIds = new Set(incoming.map((r) => r._id));

    // First load: silently seed known IDs
    if (isInitialLoad.current) {
      seenRequestIds.current = incomingIds;
      isInitialLoad.current = false;
      return;
    }

    // Detect newly arrived requests
    incoming.forEach((req) => {
      if (!seenRequestIds.current.has(req._id)) {
        seenRequestIds.current.add(req._id);

        const senderName = req.sender?.fullName || "A user";
        const senderAvatar = req.sender?.profilePic || "/p7.png";

        toast.custom(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                navigate("/notifications");
              }}
              className={`cursor-pointer max-w-sm w-full bg-base-100 border border-primary/40 shadow-2xl rounded-xl p-3 flex items-center gap-3 transition-all hover:scale-[1.02] ${
                t.visible ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="avatar size-10 rounded-full overflow-hidden border border-primary/30 shrink-0">
                <img
                  src={senderAvatar}
                  alt={senderName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/p7.png";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs text-primary truncate">Friend Request</p>
                <p className="text-xs text-base-content/80 truncate mt-0.5">
                  <span className="font-medium text-base-content">{senderName}</span> sent you a friend request
                </p>
              </div>
            </div>
          ),
          { duration: 4000, id: `fr_${req._id}` }
        );
      }
    });

    // Reconcile seen IDs
    seenRequestIds.current = incomingIds;
  }, [friendRequests, navigate]);

  const pendingFriendRequestCount = friendRequests?.incomingReqs?.length || 0;
  const totalNotificationCount = unreadMessageCount + pendingFriendRequestCount;

  return (
    <NotificationContext.Provider
      value={{
        chatClient,
        isChatReady,
        unreadMessageCount,
        pendingFriendRequestCount,
        totalNotificationCount,
        unreadChannels,
        activeChatUserId,
        setActiveChatUserId,
        friendRequests,
        refetchUnreadChannels: () => chatClient && fetchUnreadChannels(chatClient),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      chatClient: null,
      isChatReady: false,
      unreadMessageCount: 0,
      pendingFriendRequestCount: 0,
      totalNotificationCount: 0,
      unreadChannels: [],
      activeChatUserId: null,
      setActiveChatUserId: () => {},
      friendRequests: null,
      refetchUnreadChannels: () => {},
    };
  }
  return context;
};
