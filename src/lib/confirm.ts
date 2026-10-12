import { invoke } from "@/lib/platform";

/** Payload of the `confirm-request` event, sent when pixi asks the user a question. */
export interface ConfirmRequest {
  id: number;
  message: string;
}

export async function answerConfirm(id: number, value: boolean): Promise<void> {
  await invoke("answer_confirm", { id, value });
}
