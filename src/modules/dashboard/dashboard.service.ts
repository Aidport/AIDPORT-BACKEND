import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Shipment, ShipmentDocument, ShipmentStatus } from '../shipment/entities/shipment.entity';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
  ) {}

  async getUserDashboard(userId: string) {
    const [myShipments, recentShipments, byStatus] = await Promise.all([
      this.shipmentModel
        .find({ createdBy: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('acceptedBy', 'name email')
        .lean(),
      this.shipmentModel
        .find({ createdBy: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      this.shipmentModel.aggregate([
        { $match: { createdBy: new Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const total = await this.shipmentModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    return {
      totalShipments: total,
      recentShipments,
      myShipments,
      byStatus: byStatus.reduce((acc, s) => {
        acc[s._id] = s.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async getAgentDashboard(agentId: string) {
    const [
      incomingCount,
      myAccepted,
      deliveredCount,
      recentIncoming,
      weeklyDelivered,
    ] = await Promise.all([
      this.shipmentModel.countDocuments({ status: ShipmentStatus.Pending }),
      this.shipmentModel
        .find({ acceptedBy: new Types.ObjectId(agentId) })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('createdBy', 'name email')
        .lean(),
      this.shipmentModel.countDocuments({
        acceptedBy: new Types.ObjectId(agentId),
        status: ShipmentStatus.Delivered,
      }),
      this.shipmentModel
        .find({ status: ShipmentStatus.Pending })
        .sort({ urgency: -1, createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'name email')
        .lean(),
      this.shipmentModel.aggregate([
        {
          $match: {
            acceptedBy: new Types.ObjectId(agentId),
            status: ShipmentStatus.Delivered,
            deliveredAt: { $exists: true },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 7 },
      ]),
    ]);

    const inTransit = await this.shipmentModel.countDocuments({
      acceptedBy: new Types.ObjectId(agentId),
      status: ShipmentStatus.InTransit,
    });
    const accepted = await this.shipmentModel.countDocuments({
      acceptedBy: new Types.ObjectId(agentId),
      status: ShipmentStatus.Accepted,
    });

    return {
      incomingCount,
      myAcceptedCount: myAccepted.length,
      deliveredCount,
      inTransitCount: inTransit,
      acceptedCount: accepted,
      recentIncoming,
      myAccepted,
      weeklyDelivered: weeklyDelivered.map((w) => ({ date: w._id, count: w.count })),
    };
  }
}
