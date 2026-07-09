export function TailwindIndicator() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="pointer-events-none fixed bottom-16 left-2 z-50 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-800/70 px-1.5 font-mono text-[10px] leading-none text-white">
      <div className="block sm:hidden">xs</div>
      <div className="hidden sm:block md:hidden">sm</div>
      <div className="hidden md:block lg:hidden">md</div>
      <div className="hidden lg:block xl:hidden">lg</div>
      <div className="hidden xl:block 2xl:hidden">xl</div>
      <div className="hidden 2xl:block">2xl</div>
    </div>
  );
}
