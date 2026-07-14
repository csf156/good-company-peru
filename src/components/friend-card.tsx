import { MapPin, ShieldCheck } from "lucide-react";
import type { Friend } from "@/lib/mock-data";
import { LevelBadge } from "./level-badge";

interface Props {
  friend: Friend;
}

export function FriendCard({ friend }: Props) {
  return (
    <div
      className="relative h-[520px] w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10"
      style={{ background: friend.photo }}
    >
      {/* soft grain overlay */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, hsl(38 85% 55% / 0.4), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 0% / 0.6), transparent 50%)",
        }}
      />
      {/* huge initial */}
      <div className="absolute right-6 top-6 font-serif text-[160px] italic leading-none text-white/10">
        {friend.alias.charAt(0)}
      </div>

      {/* verified pin */}
      {friend.verified && (
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 backdrop-blur">
          <ShieldCheck size={12} className="text-primary" strokeWidth={2} />
          <span className="text-[10px] font-medium text-white">DNI verificado</span>
        </div>
      )}

      {/* bottom gradient + content */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-6 pt-24">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-serif text-3xl italic text-white">
            {friend.name.split(" ")[0]}, {friend.age}
          </h2>
          <LevelBadge level={friend.level} />
        </div>
        <p className="mb-3 flex items-center gap-1.5 text-sm text-white/70">
          {friend.profession}
          <span className="text-white/30">•</span>
          <MapPin size={12} strokeWidth={2} />
          {friend.district}
        </p>
        <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-white/85">{friend.bio}</p>
        <div className="flex flex-wrap gap-2">
          {friend.interests.slice(0, 3).map((i) => (
            <span
              key={i}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/90"
            >
              {i}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
