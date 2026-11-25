import { IsNumber, IsString } from 'class-validator';

export class ReportSentenceHistoryDto {
  @IsString()
  taskId!: string;
  @IsNumber()
  hintCount!: number;
  /// 思考时间 单位ms
  @IsNumber()
  thinkingTime!: number;
}
