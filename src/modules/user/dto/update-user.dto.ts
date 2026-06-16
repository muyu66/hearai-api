import {
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PronunciationType } from 'src/generated/prisma/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  wordLevel: number | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  dailyWordCount: number | null;

  @IsOptional()
  @IsEnum(PronunciationType)
  pronType: PronunciationType | null;
}
