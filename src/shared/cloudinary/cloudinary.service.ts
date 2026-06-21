import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { EnvConfig } from '../../config/configuration';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    const cloudName = config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const apiKey = config.get('CLOUDINARY_API_KEY', { infer: true });
    const apiSecret = config.get('CLOUDINARY_API_SECRET', { infer: true });
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.configured = true;
    }
  }

  onModuleInit(): void {
    if (this.configured) {
      const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME', {
        infer: true,
      });
      this.logger.log(`Cloudinary ready (cloud: ${cloudName})`);
      return;
    }
    this.logger.warn(
      'Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in .env',
    );
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getSignedUploadUrl(
    folder: string,
    resourceType: 'image' | 'raw' | 'auto' = 'image',
  ) {
    const timestamp = Math.round(Date.now() / 1000);
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const apiKey = this.config.get('CLOUDINARY_API_KEY', { infer: true });
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });
    if (!cloudName || !apiKey || !apiSecret) {
      return {
        uploadUrl: null,
        signature: null,
        timestamp,
        cloudName,
        apiKey,
        folder,
      };
    }
    const params = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      signature,
      timestamp,
      apiKey,
      folder,
      cloudName,
    };
  }
}
