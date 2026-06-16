import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class ReportDailyTaskWordDto {
  @IsString()
  taskWordId: bigint;
  @IsNumber()
  failedCount: number;
  /// 思考时间 单位ms
  @IsNumber()
  thinkingTime: number;
  @IsBoolean()
  master: boolean;
}
