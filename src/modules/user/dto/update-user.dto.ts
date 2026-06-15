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
  wordLevel?: number;

  @IsOptional()
  @IsNumber()
  @MinLength(1)
  @MaxLength(100)
  dailyWordCount?: number;

  @IsOptional()
  @IsEnum(PronunciationType)
  pronType?: PronunciationType;
}
