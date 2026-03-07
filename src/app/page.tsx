"use client";

//import ChatBox from "@/components/home/ChatBox";
import LeftPanel from "@/components/home/left-panel";
import RightPanel from "@/components/home/right-panel";
import { useOfflineMessageSync } from "@/lib/hooks/useOfflineMessageSync";

//import { useTheme } from "next-themes";

export default function Home() {
  //const { setTheme } = useTheme();

  useOfflineMessageSync();

  return (
    <main className='m-5'>
      <div className='flex overflow-y-hidden h-[calc(100vh-50px)] max-w-[1700px] mx-auto bg-[hsl(var(--gray-secondary))]'>
        {/* Green background decorator for Light Mode */}
        <div className='fixed top-0 left-0 w-full h-36 bg-green-primary dark:bg-transparent -z-30' />
        {/* <ChatBox /> */}
        <LeftPanel />
        <RightPanel />
      </div>
    </main>
  );
}
