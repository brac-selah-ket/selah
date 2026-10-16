export interface ContiPraiseThreadButtonState {
  disabled: boolean
  label: "스레드에 올리기" | "스레드 업데이트"
  disabledReason: string | null
}

export function deriveContiPraiseThreadButtonState(input: {
  hasSongs: boolean
  hasThread: boolean
  lastSentAt: string | null
  isPending: boolean
}): ContiPraiseThreadButtonState {
  const disabledReason = !input.hasSongs
    ? "곡을 먼저 추가하세요"
    : !input.hasThread
      ? "이 주일 예배 스레드가 아직 없어요"
      : null

  return {
    disabled: input.isPending || disabledReason !== null,
    label: input.lastSentAt ? "스레드 업데이트" : "스레드에 올리기",
    disabledReason,
  }
}
