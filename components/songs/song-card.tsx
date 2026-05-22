import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, MusicNoteSquare01Icon } from "@hugeicons/core-free-icons";
import type { Song } from "@/lib/types";

interface SongCardProps {
  song: Song;
}

export function SongCard({ song }: SongCardProps) {
  const formattedDate = new Date(song.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link
      href={`/songs/${song.id}`}
      className="group grid gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/55 sm:grid-cols-[2rem_1fr_auto] sm:items-center"
    >
      <div className="hidden size-8 items-center justify-center rounded-md bg-muted text-primary sm:flex">
        <HugeiconsIcon icon={MusicNoteSquare01Icon} strokeWidth={2} className="size-5" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">{song.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{formattedDate} 등록</p>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
        열기
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
      </div>
    </Link>
  );
}
