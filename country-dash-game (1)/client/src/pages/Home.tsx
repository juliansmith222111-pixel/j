import Game from "@/components/Game";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0f0518] items-center justify-center p-4">
      <div className="w-full">
        <Game />
      </div>
    </div>
  );
}
