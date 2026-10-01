const fs = require('fs');
const path = require('path');
const {VehicleType} = require('../models/index');
const {Holiday} = require('../models/index');
const moment = require('moment');

class vehiclecontroller {

    static vehicle_tariff_list = async (req, res) => {
        try {
            // Fetch all vehicles from the VehicleType table
            const vehicles = await Holiday.findAll();
    
            // Pass the vehicle data to the view
            res.render("admin/vehicle_list", { vehicles });
        } catch (error) {
            console.log(error);
        }
    }
    
    static vehicle_list = async (req, res) => {
        try {
            const vehicles = await VehicleType.findAll();
            res.render("admin/vehicle_list", { vehicles });
        } catch (error) {
            console.log(error);
        }
    }

   static store_vehicle = async (req, res) => {
        try {
            const {
            type_name,
            label,
            capacity,
            minimum_km,
            minimum_fare,
            fare_per_km,
            platform_fee,
            description,
            shift_type,
            start_time,
            end_time,
            is_holiday // <-- new field
            } = req.body;

            const vehicleImage = req.files['vehicle_image'] ? req.files['vehicle_image'][0].filename : null;
            const vehicleLogo = req.files['vehicle_logo'] ? req.files['vehicle_logo'][0].filename : null;

            await VehicleType.create({
            type_name,
            label: label || null,
            capacity: capacity || null,
            minimum_km: parseFloat(minimum_km),
            minimum_fare: parseFloat(minimum_fare),
            fare_per_km: parseFloat(fare_per_km),
            platform_fee: parseFloat(platform_fee),
            description,
            shift_type,
            start_time,
            end_time,
            is_holiday: is_holiday ? true : false, // <-- new column
            vehicle_image: vehicleImage,
            vehicle_logo: vehicleLogo
            });

            req.flash('success', 'Vehicle add successfully');
            res.redirect("/vehicles");

        } catch (error) {
            req.flash('error', 'Vehicle not Stored');
            console.log("❌ Error storing vehicle:", error);
            res.status(500).send("Something went wrong");
        }
   };


       // 🧨 Delete vehicle along with its image/logo files
       static delete_vehicle = async (req, res) => {
        try {
            const { id } = req.params;
            const vehicle = await VehicleType.findByPk(id);

            if (!vehicle) {
                req.flash('error', 'Vehicle not found'); // Flash error message
                return res.redirect('/vehicles');
            }

            // Define paths to images folder
            const imagePath = path.join(__dirname, '..', 'public', 'uploads', 'vehicles');

            // Delete image files if they exist
            if (vehicle.vehicle_image) {
                const imageFullPath = path.join(imagePath, vehicle.vehicle_image);
                if (fs.existsSync(imageFullPath)) fs.unlinkSync(imageFullPath);
            }

            if (vehicle.vehicle_logo) {
                const logoFullPath = path.join(imagePath, vehicle.vehicle_logo);
                if (fs.existsSync(logoFullPath)) fs.unlinkSync(logoFullPath);
            }

            // Delete from DB
            await VehicleType.destroy({ where: { id } });

            req.flash('success', 'Vehicle deleted successfully'); // Flash success message
            res.redirect("/vehicles");
        } catch (error) {
            console.log("❌ Error deleting vehicle:", error);
            req.flash('error', 'Something went wrong'); // Flash error message
            res.redirect('/vehicles');
        }
    };

 static edit_vehicle = async (req, res) => {
        try {
            const { id } = req.params;
            const vehicle = await VehicleType.findByPk(id);

            if (!vehicle) {
                req.flash('error', 'Vehicle not found');
                return res.redirect('/admin/vehicle_list');
            }

            res.render("admin/vehicle_edit", { vehicle });

        } catch (error) {
            console.error("❌ Error fetching vehicle for edit:", error);
            req.flash('error', 'Failed to fetch vehicle details');
            res.redirect('/admin/vehicle_list');
        }
    };

static update_vehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const vehicle = await VehicleType.findByPk(id);
        if (!vehicle) {
            req.flash('error', 'Vehicle not found');
            return res.redirect('/admin/vehicle_list');
        }

        req.body.is_holiday = req.body.is_holiday === '1' || req.body.is_holiday === 1;
        const fieldsToUpdate = [
            'type_name',
            'label', 
            'capacity',
            'minimum_km',
            'minimum_fare',
            'fare_per_km',
            'platform_fee',
            'description',
            'shift_type',
            'start_time',
            'end_time',
            'is_holiday'
        ];

        fieldsToUpdate.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                vehicle[field] = req.body[field];
            }
        });
        const imagePath = path.join(__dirname, '..', 'public', 'uploads', 'vehicles');
        const fileFields = ['vehicle_image', 'vehicle_logo'];
        fileFields.forEach(field => {
            if (req.files?.[field]) {
                const oldPath = path.join(imagePath, vehicle[field] || '');
                try {
                    if (vehicle[field] && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                 } catch (err) {
                    console.error(`Error deleting old ${field}:`, err);
                }
                vehicle[field] = req.files[field][0].filename;
            }
        });
        await vehicle.save();
        req.flash('success', 'Vehicle updated successfully');
        res.redirect(`/vehicles/edit/${req.params.id}`);

    } catch (error) {
        console.error("❌ Error updating vehicle:", error);
        req.flash('error', 'Failed to update vehicle');
        res.redirect(`/vehicles/edit/${req.params.id}`);
    }
};

    static holiday_list = async (req, res) => {
        try {
            const holidays = await Holiday.findAll();
            res.render("admin/holidaylist", { holidays });
          } catch (error) {
            console.log(error);
        }
    }

    static holiday_edit = async (req, res) => {
    try {
        const holidayId = req.params.id;
        const holiday = await Holiday.findOne({ where: { id: holidayId } });

        if (!holiday) {
        return res.status(404).send("Holiday not found");
        }

        res.render("admin/holidayedit", { holiday, moment });
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
    };

    static holiday_update = async (req, res) => {
     try {
        const { id } = req.params;
        const { name, date } = req.body;
        if (!name || !date) {
          return res.status(400).send("Name and date are required.");
        }
        const updated = await Holiday.update(
        {
            name: name,
            date: moment(date).format('YYYY-MM-DD')
        },
        {
            where: { id }
        }
        );

        if (updated[0] === 0) {
          return res.status(404).send("Holiday not found or not updated.");
        }

        res.redirect('/holidaylist'); 

    } catch (error) {
        console.error("Error updating holiday:", error);
        res.status(500).send("Server error.");
    }
};

}
module.exports = vehiclecontroller;
