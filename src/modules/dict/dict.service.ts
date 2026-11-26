import { PrismaService } from '@/database/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { DictDto } from './dto/dict.dto';
import { OssService } from '@/common/providers/oss.provider';
import { sample } from 'es-toolkit';
import { SPEAKERS } from '@/common/constants/constants';

@Injectable()
export class DictService {
  private readonly logger = new Logger(DictService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ossService: OssService,
  ) {}

  /**
   * 处理翻译格式
   * @param model
   * @returns
   */
  private formatTranslation(translation: string): string {
    if (!translation) return '';
    return translation
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\r\n|\r/g, '\n');
  }

  /**
   * 获取单词内容
   * @param word
   * @param sourceLang
   * @param targetLang
   * @returns
   */
  async getByWord(word: string): Promise<DictDto | null> {
    const data = await this.prisma.aiDict.findUnique({
      where: {
        word,
      },
    });
    if (data == null) return null;
    data.translation = this.formatTranslation(data.translation);
    const ukPronUrl = await this.getPronUrl(data.word, 'uk', sample(SPEAKERS));
    const usPronUrl = await this.getPronUrl(data.word, 'us', sample(SPEAKERS));

    return {
      word: data.word,
      translation: data.translation,
      ukPhonetic: data.ukPhonetic,
      usPhonetic: data.usPhonetic,
      ukPronUrl,
      usPronUrl,
    };
  }

  private async getPronUrl(
    word: string,
    phoneticType: 'uk' | 'us',
    speaker: string,
  ): Promise<string | null> {
    return this.ossService.generateSignatureUrl(
      `word_pronunciations/speakers/${speaker}/${phoneticType}/${word}.wav`,
    );
  }

  /**
   * 增加单词的 badScore
   * @param word
   */
  async badDict(word: string) {
    await this.prisma.aiDict.update({
      where: { word },
      data: {
        badScore: {
          increment: 1,
        },
      },
    });
  }
}
