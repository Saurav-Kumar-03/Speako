import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import useAuthUser from '../hooks/useAuthUser';
import { useQuery } from '@tanstack/react-query';
import { getStreamToken } from '../lib/api';

import {
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  StreamTheme,
  SpeakerLayout,
  CallControls,
} from '@stream-io/video-react-sdk';

import '@stream-io/video-react-sdk/dist/css/styles.css';
import { create } from 'zustand';
import toast from 'react-hot-toast';
import PageLoader from '../components/PageLoader';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;
const CallPage = () => {

  const { id: CallId } = useParams();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const { authUser, isLoading } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ['streamToken'],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    const initCall = async () => {
      if (!tokenData.token || !authUser || !CallId) return;
      try {
        console.log("Initializing Stream | Client...");
        const user = {
          id: authUser._id,
          name: authUser.fullName || authUser.fullname,
          image: authUser.profilePic || "/p7.png",
        }
        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user,
          token: tokenData.token,
        })
        const callInstance = videoClient.call("default", CallId);

        await callInstance.join({ create: true });

        console.log("Joined Call Successfully");
        setClient(videoClient);
        setCall(callInstance);

      } catch (error) {
        console.error("Error joining call:", error);
        toast.error("Could not join the call .Please try again!");
      } finally {
        setIsConnecting(false);
      }
    }
    initCall();
  }, [tokenData, authUser, CallId])

  if (isLoading || isConnecting) return <PageLoader />;
  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <div className="relative">
        {client && call ? (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <CallContent />
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Could not initialize call. Please refresh or try again later.</p>
          </div>
        )}
      </div>
    </div>
  )
}

const CallContent = () => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();

  const navigate = useNavigate();

  if (callingState === CallingState.LEFT) return navigate("/");

  return (
    <StreamTheme>
      <SpeakerLayout />
      <CallControls />
    </StreamTheme>
  );
}
export default CallPage
