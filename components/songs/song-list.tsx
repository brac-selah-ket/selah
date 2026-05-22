"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SongCard } from "./song-card";
import type { Song } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { SearchIcon } from "@hugeicons/core-free-icons";

interface SongListProps {
  songs: Song[];
}

export function SongList({ songs }: SongListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSongs = songs.filter((song) =>
    song.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showEmptyState = songs.length === 0;
  const showSearchEmptyState = !showEmptyState && filteredSongs.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="relative">
          <HugeiconsIcon
            icon={SearchIcon}
            strokeWidth={2}
            className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="곡 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {showEmptyState && (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-card/70 px-6 py-10 text-center">
          <p className="font-serif-kr text-2xl font-semibold text-foreground">아직 등록된 곡이 없습니다</p>
          <p className="mt-2 text-base text-muted-foreground">자주 부르는 찬양부터 하나씩 추가해보세요.</p>
        </div>
      )}

      {showSearchEmptyState && (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-card/70 px-6 py-10 text-center">
          <p className="font-serif-kr text-2xl font-semibold text-foreground">검색 결과가 없습니다</p>
          <p className="mt-2 text-base text-muted-foreground">다른 곡 이름으로 다시 찾아보세요.</p>
        </div>
      )}

      {!showEmptyState && !showSearchEmptyState && (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {filteredSongs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </div>
  );
}
