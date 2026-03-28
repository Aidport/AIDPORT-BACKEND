import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformSettings,
  PlatformSettingsDocument,
} from './entities/platform-settings.entity';

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectModel(PlatformSettings.name)
    private model: Model<PlatformSettingsDocument>,
  ) {}

  async getOrCreate(): Promise<PlatformSettingsDocument> {
    let doc = await this.model.findOne().sort({ createdAt: 1 }).exec();
    if (!doc) {
      doc = await this.model.create({
        platformName: 'Aidport',
        notifyNewSystemUpdates: true,
        notifyNewShipment: true,
        notifyVerificationUpdate: true,
      });
    }
    return doc;
  }

  async update(
    patch: Partial<
      Pick<
        PlatformSettings,
        | 'platformName'
        | 'adminEmail'
        | 'notifyNewSystemUpdates'
        | 'notifyNewShipment'
        | 'notifyVerificationUpdate'
      >
    >,
  ) {
    const doc = await this.getOrCreate();
    return this.model
      .findByIdAndUpdate(doc._id, { $set: patch }, { new: true })
      .exec();
  }
}
