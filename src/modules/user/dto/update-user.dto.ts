import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  sentenceLevel?: number | null;
}
