import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sheetMusicFiles = sqliteTable('sheet_music_files', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const songPresets = sqliteTable('song_presets', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  presetType: text('preset_type').notNull().default('single'),
  displayTitle: text('display_title'),
  name: text('name').notNull(),
  keys: text('keys'),
  tempos: text('tempos'),
  sectionOrder: text('section_order'),
  lyrics: text('lyrics'),
  sectionLyricsMap: text('section_lyrics_map'),
  notes: text('notes'),
  youtubeReference: text('youtube_reference'),
  youtubeTitle: text('youtube_title'),
  pdfMetadata: text('pdf_metadata'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const songPresetSongs = sqliteTable('song_preset_songs', {
  id: text('id').primaryKey(),
  presetId: text('preset_id').notNull().references(() => songPresets.id, { onDelete: 'cascade' }),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  partLabel: text('part_label'),
}, (table) => [
  uniqueIndex('song_preset_songs_unique').on(table.presetId, table.songId),
  uniqueIndex('song_preset_songs_order_unique').on(table.presetId, table.sortOrder),
  index('song_preset_songs_song_idx').on(table.songId),
]);

export const presetSheetMusic = sqliteTable('preset_sheet_music', {
  id: text('id').primaryKey(),
  presetId: text('preset_id').notNull().references(() => songPresets.id, { onDelete: 'cascade' }),
  sheetMusicFileId: text('sheet_music_file_id').notNull().references(() => sheetMusicFiles.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  uniqueIndex('preset_sheet_music_unique').on(table.presetId, table.sheetMusicFileId),
]);

export const contis = sqliteTable('contis', {
  id: text('id').primaryKey(),
  title: text('title'),
  date: text('date').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('contis_date_idx').on(table.date),
]);

export const contiSongs = sqliteTable('conti_songs', {
  id: text('id').primaryKey(),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'restrict' }),
  sortOrder: integer('sort_order').notNull(),
  keys: text('keys'),
  tempos: text('tempos'),
  sectionOrder: text('section_order'),
  lyrics: text('lyrics'),
  sectionLyricsMap: text('section_lyrics_map'),
  notes: text('notes'),
  sheetMusicFileIds: text('sheet_music_file_ids'),
  presetId: text('preset_id').references(() => songPresets.id, { onDelete: 'set null' }),
  mashupGroupId: text('mashup_group_id'),
  mashupPartOrder: integer('mashup_part_order'),
  preMashupPresetId: text('pre_mashup_preset_id').references(() => songPresets.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_song_unique').on(table.contiId, table.songId),
]);

export const contiPdfExports = sqliteTable('conti_pdf_exports', {
  id: text('id').primaryKey(),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  pdfUrl: text('pdf_url'),
  layoutState: text('layout_state'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_pdf_export_unique').on(table.contiId),
]);

export const songPageImages = sqliteTable('song_page_images', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  pageIndex: integer('page_index').notNull(),
  sheetMusicFileId: text('sheet_music_file_id').references(() => sheetMusicFiles.id, { onDelete: 'set null' }),
  pdfPageIndex: integer('pdf_page_index'),
  presetSnapshot: text('preset_snapshot'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const worshipPrepNotifications = sqliteTable('worship_prep_notifications', {
  id: text('id').primaryKey(),
  sundayDate: text('sunday_date').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  threadId: text('thread_id'),
  messageId: text('message_id'),
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: text('last_attempt_at'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('worship_prep_notifications_week_type_unique').on(table.sundayDate, table.type),
]);
