import assert from "node:assert/strict";
import { test } from "vitest";
import { getDefaultPresetValidationError } from "./song-preset-defaults.ts";

test("default preset validation rejects missing presets", () => {
  assert.equal(
    getDefaultPresetValidationError(null, "song-1"),
    "프리셋을 찾을 수 없습니다",
  );
});

test("default preset validation rejects mashup presets", () => {
  assert.equal(
    getDefaultPresetValidationError({ songId: "song-1", presetType: "mashup" }, "song-1"),
    "매시업 프리셋은 기본 프리셋으로 설정할 수 없습니다",
  );
});

test("default preset validation rejects presets from another song", () => {
  assert.equal(
    getDefaultPresetValidationError({ songId: "song-2", presetType: "single" }, "song-1"),
    "선택한 곡의 프리셋만 기본으로 설정할 수 있습니다",
  );
});

test("default preset validation accepts single presets from the requested song", () => {
  assert.equal(
    getDefaultPresetValidationError({ songId: "song-1", presetType: "single" }, "song-1"),
    null,
  );
});
