import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { acceptFriendRequest, getFriendRequests } from "../lib/api";
import { BellIcon, ClockIcon, MessageSquareIcon, UserCheckIcon } from "lucide-react";
import NoNotificationsFound from "../components/NoNotificationFound";
import { useNotifications } from "../context/NotificationContext";
import useAuthUser from "../hooks/useAuthUser";

const NotificationPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const { unreadChannels, refetchUnreadChannels } = useNotifications();

  useEffect(() => {
    refetchUnreadChannels();
  }, [refetchUnreadChannels]);

  const { data: friendRequests, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
  });

  const { mutate: acceptRequestMutation, isPending } = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const incomingRequests = friendRequests?.incomingReqs || [];
  const acceptedRequests = friendRequests?.acceptedReqs || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Notifications</h1>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <>
            {incomingRequests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <UserCheckIcon className="h-5 w-5 text-primary" />
                  Friend Requests
                  <span className="badge badge-primary ml-2">{incomingRequests.length}</span>
                </h2>

                <div className="space-y-3">
                  {incomingRequests.map((request) => (
                    <div
                      key={request._id}
                      className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="avatar w-14 h-14 rounded-full bg-base-300 overflow-hidden">
                              <img
                                src={request.sender?.profilePic || "/p7.png"}
                                alt={request.sender?.fullName}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/p7.png";
                                }}
                              />
                            </div>
                            <div>
                              <h3 className="font-semibold">{request.sender?.fullName}</h3>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="badge badge-secondary badge-sm">
                                  Native: {request.sender?.nativeLanguage}
                                </span>
                                <span className="badge badge-outline badge-sm">
                                  Learning: {request.sender?.learningLanguage}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => acceptRequestMutation(request._id)}
                            disabled={isPending}
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ACCEPTED REQS NOTIFICATONS */}
            {acceptedRequests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BellIcon className="h-5 w-5 text-success" />
                  New Connections
                </h2>

                <div className="space-y-3">
                  {acceptedRequests.map((notification) => (
                    <div key={notification._id} className="card bg-base-200 shadow-sm">
                      <div className="card-body p-4">
                        <div className="flex items-start gap-3">
                          <div className="avatar mt-1 size-10 rounded-full overflow-hidden">
                            <img
                              src={notification.recipient?.profilePic || "/p7.png"}
                              alt={notification.recipient.fullName}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "/p7.png";
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{notification.recipient?.fullName}</h3>
                            <p className="text-sm my-1">
                              {notification.recipient.fullName} accepted your friend request
                            </p>
                            <p className="text-xs flex items-center opacity-70">
                              <ClockIcon className="h-3 w-3 mr-1" />
                              Recently
                            </p>
                          </div>
                          <div className="badge badge-success">
                            <MessageSquareIcon className="h-3 w-3 mr-1" />
                            New Friend
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* UNREAD MESSAGES NOTIFICATIONS */}
            {unreadChannels.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <MessageSquareIcon className="h-5 w-5 text-secondary" />
                  Unread Messages
                  <span className="badge badge-secondary ml-2">{unreadChannels.length}</span>
                </h2>

                <div className="space-y-3">
                  {unreadChannels.map((channel) => {
                    const otherMember = Object.values(channel.state?.members || {}).find(
                      (m) => m.user?.id !== authUser?._id
                    )?.user;
                    const otherName = otherMember?.name || otherMember?.fullName || "Friend";
                    const otherImage = otherMember?.image || otherMember?.profilePic || "/p7.png";
                    const otherId = otherMember?.id;

                    const messages = channel.state?.messages || [];
                    const lastMessage = messages[messages.length - 1];
                    const lastText = lastMessage?.text || "Sent you a message";
                    const unreadCount = channel.countUnread ? channel.countUnread() : 1;
                    const timeString = lastMessage?.created_at
                      ? new Date(lastMessage.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently";

                    return (
                      <div
                        key={channel.id}
                        className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="card-body p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="avatar size-12 rounded-full overflow-hidden bg-base-300 shrink-0">
                                <img
                                  src={otherImage}
                                  alt={otherName}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = "/p7.png";
                                  }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold truncate">{otherName}</h3>
                                  <span className="badge badge-primary badge-xs">
                                    {unreadCount} new
                                  </span>
                                </div>
                                <p className="text-sm opacity-80 truncate">{lastText}</p>
                                <p className="text-xs flex items-center opacity-60 mt-0.5">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  {timeString}
                                </p>
                              </div>
                            </div>

                            <button
                              className="btn btn-primary btn-sm shrink-0"
                              onClick={() => navigate(`/chat/${otherId}`)}
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {incomingRequests.length === 0 && acceptedRequests.length === 0 && unreadChannels.length === 0 && (
              <NoNotificationsFound />
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default NotificationPage;