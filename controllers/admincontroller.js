const Image = require('../models/image');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Op, fn, col, literal } = require('sequelize');
const { User,Ride,Driver,VehicleType,Subscriptions,CmsPage,
    DriverTransaction, DriverSubscription, DriverPayoutRequest, DriverRechargeRequest } = require('../models/index');
const { dayList, toYmd } = require('../services/reportHelpers');
var jwt = require('jsonwebtoken');
const checkuserauth = require('../middleware/auth');

class admincontroller {
    
    static support = async (req, res) => {
        try {
            const pages = await CmsPage.findAll();

            let cms = {
                terms: {},
                privacy: {},
                help: {}
            };

            pages.forEach(p => {
                cms[p.page_type] = p;
            });

            res.render("admin/support", { cms });

        } catch (error) {
            console.log("❌ ERROR:", error);  
            res.send("Error loading CMS pages");
        }
    }

    static savePage = async (req, res) => {
        try {
            const { page_type, title, content } = req.body;

            await CmsPage.upsert({
                page_type,
                title,
                content,
                status: 1
            });

            res.redirect("/cms");
            
        } catch (error) {
            console.log(error);
            res.send("Error saving page");
        }
    }

    static deleteuser = async (req, res) => {
        try {
            res.render("admin/deleteuser",{ message: req.flash('error')});
        } catch (error) {
            console.log(error);
        }
    }
    static login = async (req, res) => {
        try {
            res.render("admin/login",{ message: req.flash('error')});
        } catch (error) {
            console.log(error);
        }
    }

    static logincheck = async (req, res) => {
        try {
            const { email, password } = req.body;
            if (email && password) {
                const user = await User.findOne({ where: { email: email.trim() } });
                if (user != null) {
                    // Direct string comparison since passwords are stored in plain text
                    if (user.password && password === user.password) {
                        const token = jwt.sign({ ID: user.id }, checkuserauth.JWT_SECRET, { expiresIn: '7d' });
                        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    
                        // Set a success flash message and then redirect to the dashboard
                        req.flash('success', 'Logged in successfully');
                        return res.redirect('/home');
                    } else {
                        // Set an error flash message for invalid email or password
                        req.flash('error', 'Email or password is not valid');
                        return res.redirect('/');
                    }
                } else {
                    // Set an error flash message for unregistered users
                    req.flash('error', 'You are not a registered user');
                    return res.redirect('/');
                }
            } else {
                // Set an error flash message for missing fields
                req.flash('error', 'All fields are required');
                return res.redirect('/');
            }
        } catch (error) {
            console.log(error);
        }
    };
    
    // ---------------- Admin profile ----------------
    static profile = async (req, res) => {
        try {
            const admin = await User.findByPk(req.admin.id, { attributes: ['id', 'name', 'email', 'phone', 'country_code', 'created_at'] });
            res.render("admin/profile", { profile: admin });
        } catch (error) {
            console.log(error);
            res.status(500).send("Something went wrong!");
        }
    }

    static profile_update = async (req, res) => {
        try {
            const name = (req.body.name || '').trim();
            const email = (req.body.email || '').trim().toLowerCase();
            const phone = (req.body.phone || '').trim();
            if (!name || !email) {
                req.flash('error', 'Name and email are required.');
                return res.redirect('/profile');
            }
            const taken = await User.findOne({ where: { email, id: { [Op.ne]: req.admin.id } }, attributes: ['id'] });
            if (taken) {
                req.flash('error', 'This email is already used by another account.');
                return res.redirect('/profile');
            }
            await User.update({ name, email, phone: phone || null }, { where: { id: req.admin.id } });
            req.flash('success', 'Profile updated.');
            res.redirect('/profile');
        } catch (error) {
            console.log(error);
            req.flash('error', 'Could not update profile.');
            res.redirect('/profile');
        }
    }

    static password_update = async (req, res) => {
        try {
            const { current_password, new_password, confirm_password } = req.body;
            const admin = await User.findByPk(req.admin.id);
            if (!admin.password || current_password !== admin.password) {
                req.flash('error', 'Current password is wrong.');
                return res.redirect('/profile#password');
            }
            if (!new_password || new_password.length < 6) {
                req.flash('error', 'New password must be at least 6 characters.');
                return res.redirect('/profile#password');
            }
            if (new_password !== confirm_password) {
                req.flash('error', 'New password and confirm password do not match.');
                return res.redirect('/profile#password');
            }
            // Stored the same way login checks it (plain text)
            admin.password = new_password;
            await admin.save();
            req.flash('success', 'Password changed.');
            res.redirect('/profile');
        } catch (error) {
            console.log(error);
            req.flash('error', 'Could not change password.');
            res.redirect('/profile');
        }
    }

    // Sidebar items that are not built yet
    static coming_soon = async (req, res) => {
        const titles = {
            '/coupons': 'Coupon Codes', '/banners': 'App Banners', '/tickets': 'Support Tickets',
            '/complaints': 'Complaints', '/settings/general': 'General Settings', '/settings/app-config': 'App Configuration',
            '/settings/roles': 'Roles & Permissions', '/settings/logs': 'System Logs',
        };
        res.render("admin/coming_soon", { title: titles[req.path] || 'This page' });
    }

    static logout = async (req, res) => {
        try {
            res.clearCookie('token')
            res.redirect("/")
        } catch (error) {
            console.log(error)
        }
    }

    static home = async (req, res) => {
        try {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
            const chartStart = new Date(todayStart); chartStart.setDate(chartStart.getDate() - 13);
            const LIVE = ['searching', 'pending', 'accepted', 'arrived', 'started', 'rideend'];

            const [
                userCount, driverCount, Ridecount, VehicleTypecount, completeTrips, cancelTrips,
                onlineDrivers, onTripDrivers, liveRides,
                todayRides, todayCompleted, todayGross, newUsersToday,
                monthGross, monthRideCharges, monthSubs,
                pendingPayouts, pendingRecharges, activeSubs,
                chartRides, recentRides, topDriversRaw, newDrivers
            ] = await Promise.all([
                User.count(),
                Driver.count(),
                Ride.count(),
                VehicleType.count(),
                Ride.count({ where: { status: 'completed' } }),
                Ride.count({ where: { status: 'cancelled' } }),
                Driver.count({ where: { online_status: true } }),
                Driver.count({ where: { status: 2 } }),
                Ride.count({ where: { status: LIVE } }),
                Ride.count({ where: { created_at: { [Op.gte]: todayStart } } }),
                Ride.count({ where: { status: 'completed', created_at: { [Op.gte]: todayStart } } }),
                Ride.sum('final_fare', { where: { status: 'completed', created_at: { [Op.gte]: todayStart } } }),
                User.count({ where: { created_at: { [Op.gte]: todayStart } } }),
                Ride.sum('final_fare', { where: { status: 'completed', created_at: { [Op.gte]: monthStart } } }),
                DriverTransaction.sum('amount', { where: { type: 'wallet', created_at: { [Op.gte]: monthStart } } }),
                DriverSubscription.findAll({
                    where: { status: ['active', 'expired'], created_at: { [Op.gte]: monthStart } },
                    include: [{ model: Subscriptions, as: 'subscription', attributes: ['price'] }],
                    attributes: ['id'],
                }),
                DriverPayoutRequest.count({ where: { status: 'pending' } }),
                DriverRechargeRequest.count({ where: { status: 'pending' } }),
                DriverSubscription.count({ where: { status: 'active', end_date: { [Op.gte]: todayStart } } }),
                Ride.findAll({
                    where: { created_at: { [Op.gte]: chartStart } },
                    attributes: ['status', 'final_fare', 'created_at'],
                    raw: true,
                }),
                Ride.findAll({
                    limit: 8,
                    order: [['created_at', 'DESC']],
                    include: [
                        { model: User, as: 'user', attributes: ['name', 'phone'] },
                        { model: Driver, as: 'driver', attributes: ['id', 'name', 'phone'] }
                    ]
                }),
                Ride.findAll({
                    where: { status: 'completed', driver_id: { [Op.ne]: null }, created_at: { [Op.gte]: monthStart } },
                    attributes: ['driver_id', [fn('COUNT', col('Ride.id')), 'rides'], [fn('SUM', col('final_fare')), 'earnings']],
                    include: [{ model: Driver, as: 'driver', attributes: ['name', 'phone'] }],
                    group: ['driver_id', 'driver.id'],
                    order: [[literal('earnings'), 'DESC']],
                    limit: 5,
                }),
                Driver.findAll({
                    attributes: ['id', 'name', 'phone', 'status', 'created_at'],
                    include: [{ model: VehicleType, attributes: ['type_name'] }],
                    order: [['created_at', 'DESC']],
                    limit: 5,
                }),
            ]);

            // 14-day chart (grouped here so it follows the server's local dates)
            const days = dayList(chartStart, new Date());
            const series = Object.fromEntries(days.map(d => [d, { completed: 0, cancelled: 0, other: 0, gross: 0 }]));
            chartRides.forEach(r => {
                const s = series[toYmd(new Date(r.created_at))];
                if (!s) return;
                if (r.status === 'completed') { s.completed++; s.gross += parseFloat(r.final_fare) || 0; }
                else if (r.status === 'cancelled') s.cancelled++;
                else s.other++;
            });

            const monthSubRevenue = monthSubs.reduce((sum, s) => sum + (parseFloat(s.subscription?.price) || 0), 0);

            res.render("admin/home", {
                userCount, driverCount, completeTrips, cancelTrips, VehicleTypecount, Ridecount,
                onlineDrivers, onTripDrivers, liveRides,
                today: {
                    rides: todayRides,
                    completed: todayCompleted,
                    gross: parseFloat(todayGross) || 0,
                    newUsers: newUsersToday,
                },
                month: {
                    gross: parseFloat(monthGross) || 0,
                    platform: (parseFloat(monthRideCharges) || 0) + monthSubRevenue,
                    subscriptions: monthSubRevenue,
                    rideCharges: parseFloat(monthRideCharges) || 0,
                    name: monthStart.toLocaleDateString('en-GB', { month: 'long' }),
                },
                pending: { payouts: pendingPayouts, recharges: pendingRecharges },
                activeSubs,
                chart: {
                    labels: days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
                    completed: days.map(d => series[d].completed),
                    cancelled: days.map(d => series[d].cancelled),
                    other: days.map(d => series[d].other),
                    gross: days.map(d => Number(series[d].gross.toFixed(2))),
                },
                recentRides,
                topDrivers: topDriversRaw.map(r => ({
                    id: r.driver_id,
                    name: r.driver?.name || 'Driver #' + r.driver_id,
                    phone: r.driver?.phone || '',
                    rides: Number(r.get('rides')) || 0,
                    earnings: parseFloat(r.get('earnings')) || 0,
                })),
                newDrivers,
            });
        } catch (error) {
            console.log("Error in home controller:", error);
            res.status(500).send("Internal Server Error");
        }
    };
    static users_list = async (req, res) => {
        try {
            const users = await User.findAll();
            res.render("admin/users_list",{ users });
        } catch (error) {
            console.log(error);
        }
    }
    static subscriptionplan_list = async (req, res) => {
        try {
            const subscriptions = await Subscriptions.findAll();
            res.render("admin/subscriptionlist",{ subscriptions });
        } catch (error) {
            console.log(error);
        }
    }
    static add_subscriptionplan = async (req, res) => {
    try {
           const { name, price, duration_days, description,mile } = req.body;

            if (!name || !price || !duration_days) {
                return res.status(400).send("Name, price, and duration are required.");
            }

            // Create subscription
            await Subscriptions.create({
                name,
                price,
                duration_days,
                description,
                mile
            });

            // Redirect or send success response
            res.redirect('/subscriptionplan_list'); // or change the path as per your routing
        } catch (error) {
            console.error("Error creating subscription:", error);
            res.status(500).send("Internal Server Error");
        }
    }
   static edit_subscriptionplan = async (req, res) => {
    try {
        const id = req.params.id;
        const subscription = await Subscriptions.findByPk(id);

        if (!subscription) {
            return res.status(404).send("Subscription not found.");
        }

        res.render('admin/subscriptionedit', { subscription }); 
    } catch (error) {
        console.error("Error fetching subscription:", error);
        res.status(500).send("Internal Server Error");
    }
}
static update_user = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, email, phone, status } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).send("User not found.");
        }

        await user.update({ name, email, phone, status });
        res.redirect('/users');
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Internal Server Error");
    }
};

static update_subscriptionplan = async (req, res) => {
    try {
        const { id, name, price, duration_days, description, mile } = req.body;
        // console.log("Body received:", req.body);
        if (
            !id?.trim() ||
            !name?.trim() ||
            isNaN(price) ||
            isNaN(duration_days) ||
            isNaN(mile)
        ) {
            return res.status(400).send("All fields are required.");
        }

        const subscription = await Subscriptions.findByPk(id);
        if (!subscription) {
            return res.status(404).send("Subscription not found.");
        }

        await subscription.update({
            name,
            price,
            duration_days,
            description,
            mile
        });

        res.redirect('/subscriptionplan_list');
    } catch (error) {
        console.error("Error updating subscription:", error);
        res.status(500).send("Internal Server Error");
    }
};


}

module.exports = admincontroller;
