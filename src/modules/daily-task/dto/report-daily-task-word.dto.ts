import { IsNumber, IsString } from 'class-validator';

export class ReportDailyTaskWordDto {
  @IsString()
  taskWordId: string;
  @IsNumber()
  failedCount: number;
  /// 思考时间 单位ms
  @IsNumber()
  thinkingTime: number;
}
