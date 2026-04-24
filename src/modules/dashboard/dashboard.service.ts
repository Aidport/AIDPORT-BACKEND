import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Shipment, ShipmentDocument, ShipmentStatus } from '../shipment/entities/shipment.entity';
import { ShipmentService } from '../shipment/shipment.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    private readonly shipmentService: ShipmentService,
  ) {}

  async getUserDashboard(userId: string) {
    const [myShipments, recentShipments, byStatus, shipmentStats] =
      await Promise.all([
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
      this.shipmentService.getShipmentStatsForShipper(userId),
    ]);

    const total = await this.shipmentModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    return {
      totalShipments: total,
      shipmentStats,
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
      shipmentStats,
    ] = await Promise.all([
      this.shipmentModel.countDocuments({
        $or: [
          { status: ShipmentStatus.Pending },
          {
            status: ShipmentStatus.Requested,
            requestedAgentId: new Types.ObjectId(agentId),
          },
        ],
      }),
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
        .find({
          $or: [
            { status: ShipmentStatus.Pending },
            {
              status: ShipmentStatus.Requested,
              requestedAgentId: new Types.ObjectId(agentId),
            },
          ],
        })
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
      this.shipmentService.getShipmentStatsForAgent(agentId),
    ]);

    const inTransit = await this.shipmentModel.countDocuments({
      acceptedBy: new Types.ObjectId(agentId),
      status: ShipmentStatus.InTransit,
    });
    const accepted = await this.shipmentModel.countDocuments({
      acceptedBy: new Types.ObjectId(agentId),
      status: { $in: [ShipmentStatus.Accepted, ShipmentStatus.Processing] },
    });

    return {
      incomingCount,
      myAcceptedCount: myAccepted.length,
      deliveredCount,
      inTransitCount: inTransit,
      acceptedCount: accepted,
      shipmentStats,
      recentIncoming,
      myAccepted,
      weeklyDelivered: weeklyDelivered.map((w) => ({ date: w._id, count: w.count })),
    };
  }
}
