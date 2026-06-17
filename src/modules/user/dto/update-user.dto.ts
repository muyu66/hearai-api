import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { MAX_DAILY_WORD_COUNT } from 'src/common/constants/constants';
import { PronunciationType } from 'src/generated/prisma/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  wordLevel: number | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_DAILY_WORD_COUNT)
  dailyWordCount: number | null;

  @IsOptional()
  @IsEnum(PronunciationType)
  pronType: PronunciationType | null;
}
