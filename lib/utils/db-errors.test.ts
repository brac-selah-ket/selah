import assert from "node:assert/strict";
import { test } from "vitest";
import { isUniqueConstraintError } from "./db-errors.ts";

test("isUniqueConstraintError detects postgres unique constraint errors", () => {
  assert.equal(
    isUniqueConstraintError(
      { code: "23505", constraint: "song_presets_mashup_pair_key_unique" },
      "song_presets_mashup_pair_key_unique",
    ),
    true,
  );
});

test("isUniqueConstraintError detects sqlite unique constraint messages", () => {
  assert.equal(
    isUniqueConstraintError(
      { code: "SQLITE_CONSTRAINT_UNIQUE", message: "UNIQUE constraint failed: song_presets.mashup_pair_key" },
      "mashup_pair_key",
    ),
    true,
  );
});

test("isUniqueConstraintError can match sqlite column messages for a named index", () => {
  assert.equal(
    isUniqueConstraintError(
      { code: "SQLITE_CONSTRAINT_UNIQUE", message: "UNIQUE constraint failed: song_presets.mashup_pair_key" },
      "song_presets_mashup_pair_key_unique",
      { columns: ["mashup_pair_key"] },
    ),
    true,
  );
});

test("isUniqueConstraintError rejects unrelated errors", () => {
  assert.equal(
    isUniqueConstraintError(new Error("network failed"), "song_presets_mashup_pair_key_unique"),
    false,
  );
});
