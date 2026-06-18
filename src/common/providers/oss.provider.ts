import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';

@Injectable()
export class OssService {
  private readonly client: OSS;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId: string = this.configService.get('OSS_ACCESS_KEY_ID', '');
    const accessKeySecret: string = this.configService.get(
      'OSS_ACCESS_KEY_SECRET',
      '',
    );
    const endpoint: string = this.configService.get('OSS_ENDPOINT', '');
    const bucket: string = this.configService.get('OSS_BUCKET', '');

    this.client = new OSS({
      region: 'oss-cn-shanghai',
      bucket,
      accessKeyId,
      accessKeySecret,
      authorizationV4: true,
      endpoint,
      secure: true,
    });
  }

  /**
   * 获取预签名URL
   * @param fileName
   * @returns
   */
  async generateSignatureUrl(fileName: string) {
    return await this.client.signatureUrlV4(
      'GET',
      3600,
      {
        headers: {}, // 请根据实际发送的请求头设置此处的请求头
      },
      fileName,
    );
  }
}
