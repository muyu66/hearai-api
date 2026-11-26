export interface UserSentenceHistoryDto {
  taskId: string;
  // 语句分词后
  tokenizeWords: string[];
  translation: string;
  pronUrl: string | null;
}
