// import React from 'react'
// import useAuthUser from '../hooks/useAuthUser'
// import { Link, useLocation } from 'react-router';

// import { BellIcon, LogOutIcon, ShipWheelIcon } from 'lucide-react';

// import ThemeSelector from './ThemeSelector';
// import useLogout from '../hooks/useLogout';

// const Navbar = () => {

//     const {authUser} =useAuthUser();
//      const location = useLocation();
//   const isChatPage = location.pathname?.startsWith("/chat");

// //   const queryClient=useQueryClient();
// //   const {mutate:logoutMutation}=useMutation({
// //     mutationFn:logout,
// //     onSuccess:()=>queryClient.invalidateQueries({queryKey:["authUser"]})
// //   })
  
//   const {logoutMutation}=useLogout()
// ;
//   return (
//      <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
//       <div className="container mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="flex items-center justify-end w-full">
//           {/* LOGO - ONLY IN THE CHAT PAGE */}
//           {isChatPage && (
//             <div className="pl-5">
//               <Link to="/" className="flex items-center gap-2.5">
//                 <ShipWheelIcon className="size-9 text-primary" />
//                 <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary  tracking-wider">
//                   Speako
//                 </span>
//               </Link>
//             </div>
//           )}

//           <div className="flex items-center gap-3 sm:gap-4 ml-auto">
//             <Link to={"/notifications"}>
//               <button className="btn btn-ghost btn-circle">
//                 <BellIcon className="h-6 w-6 text-base-content opacity-70" />
//               </button>
//             </Link>
//           </div>

//           {/* TODO */}
//           <ThemeSelector />
// <Link to="/onboarding" className="avatar hover:opacity-80 transition-opacity duration-200">
//   <div className="w-9 rounded-full">
//     <img src={authUser?.profilePic} alt="User Avatar" rel="noreferrer" />
//   </div>
// </Link>


//           {/* Logout button */}
//           <button className="btn btn-ghost btn-circle" onClick={logoutMutation}>
//             <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
//           </button>
//         </div>
//       </div>
//     </nav>
//   )
// }

// export default Navbar

import React, { useState } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { Link, useLocation, useNavigate } from "react-router";
import {
  BellIcon,
  LogOutIcon,
  MenuIcon,
  ShipWheelIcon,
  UserIcon,
  UsersIcon,
  HomeIcon,
  PaletteIcon,
} from "lucide-react";

import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutMutation } = useLogout();
  const isChatPage = location.pathname?.startsWith("/chat");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNav = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between w-full">
          {/* Chat page logo only */}
          {isChatPage ? (
            <Link to="/" className="flex items-center gap-2.5 ">
              <ShipWheelIcon className="size-9 text-primary" />
              <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                Speako
              </span>
            </Link>
          ) : (
            <div></div>
          )}

          {/* Right section */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notification - only sm+ */}
            <Link to="/notifications" className="hidden sm:inline-flex">
              <button className="btn btn-ghost btn-circle">
                <BellIcon className="h-6 w-6 text-base-content opacity-70" />
              </button>
            </Link>

            {/* Theme selector - only sm+ */}
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>

            {/* Profile - visible on all screens */}
            <Link
              to="/onboarding"
              className="avatar hover:opacity-80 transition-opacity duration-200 flex items-center"
              title="Profile"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border border-base-300">
                <img
                  src={authUser?.profilePic || "/p7.png"}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/p7.png";
                  }}
                />
              </div>
            </Link>

            {/* Logout - only sm+ */}
            <button
              className="btn btn-ghost btn-circle hidden sm:inline-flex"
              onClick={logoutMutation}
            >
              <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
            </button>

            {/* Mobile dropdown */}
            <div className="relative sm:hidden">
          <div className="flex justify-between items-center w-full">
            {!isChatPage ? (
            <Link to="/" className="flex items-center gap-2.5 ">
              <ShipWheelIcon className="size-9 text-primary" />
              <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                Speako
              </span>
            </Link>
          ) : (
            <div></div>
          )}
              <button
                className="btn btn-ghost btn-circle "
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MenuIcon className="h-6 w-6 text-base-content opacity-70" />
              </button>
          </div>
              

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-base-100 border border-base-300 shadow-xl rounded-box z-50">
                  <div className="p-3 border-b border-base-300 flex items-center gap-3">
                    <div className="avatar size-10 rounded-full overflow-hidden border border-primary/30">
                      <img
                        src={authUser?.profilePic || "/p7.png"}
                        alt="User Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/p7.png";
                        }}
                      />
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-semibold text-sm truncate">{authUser?.fullName || "User"}</p>
                      <p className="text-xs text-success flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-success inline-block" />
                        Online
                      </p>
                    </div>
                  </div>
                  <ul className="menu menu-sm p-2">
                    <li>
                      <button onClick={() => handleNav("/")}>
                        <HomeIcon className="size-4 mr-2" />
                        Home
                      </button>
                    </li>
                    <li>
                      <button onClick={() => handleNav("/friends")}>
                        <UsersIcon className="size-4 mr-2" />
                        Friends
                      </button>
                    </li>
                    <li>
                      <button onClick={() => handleNav("/notifications")}>
                        <BellIcon className="size-4 mr-2" />
                        Notifications
                      </button>
                    </li>
                    <li>
                      <button onClick={() => handleNav("/onboarding")}>
                        <UserIcon className="size-4 mr-2" />
                        Update Profile
                      </button>
                    </li>
                    <li>
                      <div className="px-0">
                        <ThemeSelector  />
                        Change Theme

                      </div>
                    </li>
                    <li>
                      <button onClick={logoutMutation}>
                        <LogOutIcon className="size-4 mr-2" />
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
