const { Driver, VehicleType, Ride, User, DriverDocument, Rating_Reviews, Payment, SplitPayment, DriverTransaction, sequelize } = require('../models/index');
const { Op } = require('sequelize');

class bookingcontroller {
    
static booking_list = async (req, res) => {
    try {
        const statusFilter = req.query.status;
        const whereClause = statusFilter ? { status: statusFilter } : {};

        const bookings = await Ride.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Driver,
                    as: 'driver',
                    attributes: ['id', 'name', 'vehicle_number'],
                    include: [
                        {
                            model: DriverDocument,
                            as: 'DriverDocuments',
                            attributes: ['document_type']
                        },
                        {
                            model: VehicleType,
                            as: 'VehicleType',
                            attributes: ['type_name']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name', 'email']
                },
                {
                    model: Rating_Reviews,
                    as: 'Rating_Reviews',
                    attributes: ['rated_by_driver', 'rated_by_user',
                                'reviewed_by_user', 'reviewed_by_driver']
                }
            ]
        });

        res.render("admin/booking_list", {
            bookings,
            currentStatus: statusFilter || 'all'
        });

    } catch (error) {
        console.log(error);
        res.status(500).send("Error fetching booking data");
    }
}

// New booking_details function
static booking_details = async (req, res) => {
    try {
        const bookingId = req.params.id;

        const booking = await Ride.findOne({
            where: { id: bookingId },
            include: [
                {
                    model: Driver,
                    as: 'driver',
                    attributes: ['id', 'name', 'phone', 'vehicle_number'],
                    include: [
                        {
                            model: DriverDocument,
                            as: 'DriverDocuments',
                            attributes: ['document_type']
                        },
                        {
                            model: VehicleType,
                            as: 'VehicleType',
                            attributes: ['type_name']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name', 'phone']
                },
                {
                    model: Rating_Reviews,
                    as: 'Rating_Reviews',
                    attributes: ['rated_by_driver', 'rated_by_user',
                                 'reviewed_by_user', 'reviewed_by_driver']
                }
            ]
        });

        if (!booking) {
            return res.status(404).send("Booking not found");
        }

        res.render("admin/booking_details", { booking });

    } catch (error) {
        console.log(error);
        res.status(500).send("Error fetching booking details");
    }
}

    static booking_delete_multiple = async (req, res) => {
        const t = await sequelize.transaction();
        try {
            let { ids } = req.body;
            if (typeof ids === 'string') {
                try { ids = JSON.parse(ids); } catch { ids = [ids]; }
            }
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: "ids array is required" });
            }
            ids = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
            if (ids.length === 0) {
                return res.status(400).json({ success: false, message: "No valid ids provided" });
            }

            await DriverTransaction.destroy({ where: { ride_id: { [Op.in]: ids } }, transaction: t });
            await Rating_Reviews.destroy({ where: { ride_id: { [Op.in]: ids } }, transaction: t });
            await SplitPayment.destroy({ where: { ride_id: { [Op.in]: ids } }, transaction: t });
            await Payment.destroy({ where: { ride_id: { [Op.in]: ids } }, transaction: t });

            const deletedCount = await Ride.destroy({ where: { id: { [Op.in]: ids } }, transaction: t });

            await t.commit();
            return res.json({ success: true, message: `${deletedCount} booking(s) deleted`, deletedCount });
        } catch (error) {
            await t.rollback();
            console.log("booking_delete_multiple error:", error);
            return res.status(500).json({ success: false, message: "Error deleting bookings" });
        }
    }

    static booking_delete = async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const bookingId = req.params.id;

            // Pehle child rows hata do (FK constraints satisfy karne ke liye)
            await DriverTransaction.destroy({ where: { ride_id: bookingId }, transaction: t });
            await Rating_Reviews.destroy({ where: { ride_id: bookingId }, transaction: t });
            await SplitPayment.destroy({ where: { ride_id: bookingId }, transaction: t });
            await Payment.destroy({ where: { ride_id: bookingId }, transaction: t });

            const deleted = await Ride.destroy({ where: { id: bookingId }, transaction: t });

            if (!deleted) {
                await t.rollback();
                return res.status(404).send("Booking not found");
            }

            await t.commit();
            return res.redirect('/bookings');
        } catch (error) {
            await t.rollback();
            console.log("booking_delete error:", error);
            return res.status(500).send("Error deleting booking");
        }
    }

    static cancel_booking = async (req, res) => {
        try {

            const bookingId = req.params.id;
            const ride = await Ride.findByPk(bookingId);

            if (!ride) {
                req.flash('error', 'Booking not found');
                return res.redirect('/bookings');
            }

            if (!['pending', 'accepted', 'arrived'].includes(ride.status)) {
                req.flash('error', `Booking cannot be cancelled at "${ride.status}" stage`);
                return res.redirect('/bookings');
            }

            ride.status = 'cancelled';
            ride.cancelled_by = 'admin';
            await ride.save();

            const io = req.app.get('io');

            if (ride.driver_id) {
                await Driver.update({ status: '1' }, { where: { id: ride.driver_id } });

                if (io) {
                    io.to(`driver_${ride.driver_id}`).emit('rideCancelled', {
                        rideId: ride.id,
                        by: 'admin'
                    });
                }
            }

            if (io) {
                io.to(`ride_${ride.id}`).emit('rideStatusUpdate', { status: ride });
                io.to(`user_${ride.user_id}`).emit('rideCancelled', {
                    rideId: ride.id,
                    by: 'admin'
                });
            }

            req.flash('success', 'Booking cancelled successfully');
            return res.redirect('/bookings');

        } catch (error) {
            console.log(error);
            req.flash('error', 'Error cancelling booking');
            return res.redirect('/bookings');
        }
    }
}

module.exports = bookingcontroller;
