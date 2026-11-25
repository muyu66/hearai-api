export interface UserSentenceHistoryDto {
  taskId: string;
  words: string;
  translation: string;
  pronUrl: string | null;
}
