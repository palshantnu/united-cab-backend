const Image = require('../models/image');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Op, fn, col } = require('sequelize');
const { User,Ride,Driver,VehicleType,Subscriptions,CmsPage } = require('../models/index');
var jwt = require('jsonwebtoken');

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
                const user = await User.findOne({ email: email });
                if (user != null) {
                    // Direct string comparison since passwords are stored in plain text
                    if (password === user.password) {
                        const token = jwt.sign({ ID: user._id }, process.env.JWT_SECRET);
                        res.cookie('token', token);
    
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
            const [userCount, driverCount, Ridecount, VehicleTypecount, completeTrips, cancelTrips, onlineDrivers] = await Promise.all([
                User.count(),
                Driver.count(),
                Ride.count(),
                VehicleType.count(),
                Ride.count({ where: { status: 'completed' } }),
                Ride.count({ where: { status: 'cancelled' } }),
                Driver.count({ where: { online_status: true } })
            ]);

            // Total revenue from completed rides
            const revenueResult = await Ride.findOne({
                attributes: [[fn('SUM', col('final_fare')), 'total']],
                where: { status: 'completed' },
                raw: true
            });
            const totalRevenue = parseFloat(revenueResult?.total || 0).toFixed(2);

            // Last 7 days ride data for chart
            const days = [];
            const dayCounts = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push(d.toISOString().split('T')[0]);
                dayCounts.push(0);
            }
            const last7Raw = await Ride.findAll({
                attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
                where: { created_at: { [Op.gte]: new Date(days[0] + 'T00:00:00') } },
                group: [fn('DATE', col('created_at'))],
                order: [[fn('DATE', col('created_at')), 'ASC']],
                raw: true
            });
            last7Raw.forEach(row => {
                const idx = days.indexOf(row.date);
                if (idx !== -1) dayCounts[idx] = parseInt(row.count);
            });
            const dayLabels = days.map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

            // Recent 6 rides
            const recentRides = await Ride.findAll({
                limit: 6,
                order: [['created_at', 'DESC']],
                include: [
                    { model: User, as: 'user', attributes: ['name', 'phone'] },
                    { model: Driver, as: 'driver', attributes: ['name', 'phone'] }
                ]
            });

            res.render("admin/home", {
                userCount, driverCount, completeTrips, cancelTrips,
                VehicleTypecount, Ridecount, onlineDrivers, totalRevenue,
                dayLabels: JSON.stringify(dayLabels),
                dayCounts: JSON.stringify(dayCounts),
                recentRides
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
