import { IsString, MinLength } from 'class-validator';

export class SearchOrdersDto {
  @IsString()
  @MinLength(3, { message: 'Search query must be at least 3 characters' })
  q: string;
}
