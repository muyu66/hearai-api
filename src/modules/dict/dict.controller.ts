import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { DictService } from './dict.service';
import { DictDto } from './dto/dict.dto';

@Controller('api/dicts')
export class DictController {
  private readonly logger = new Logger(DictController.name);

  constructor(private readonly dictService: DictService) {}

  /**
   * 给这个词典里的单词打差评
   * @param word
   * @returns
   */
  @Post(':word/bad-feedback')
  async bad(@Body() body: { id: string }) {
    return this.dictService.badDict(body.id);
  }

  /**
   * 根据单词，获取词典的内容
   * @param word
   * @returns
   */
  @Get(':word')
  async getDict(@Param('word') word: string): Promise<DictDto> {
    const data = await this.dictService.getByWord(word);
    if (data == null) {
      throw new NotFoundException('未找到单词');
    }
    return data;
  }
}
