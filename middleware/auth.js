const jwt = require('jsonwebtoken')
const { User } = require('../models/index.js')

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const JWT_SECRET = process.env.JWT_SECRET

// Returns the logged-in admin (a row in the user table) or null
const loadAdmin = async (req) => {
    const { token } = req.cookies || {}
    if (!token) return null
    try {
        const { ID } = jwt.verify(token, JWT_SECRET)
        if (!ID) return null // tokens from the old login had no ID
        return await User.findByPk(ID, { attributes: ['id', 'name', 'email', 'phone', 'profile'] })
    } catch (err) {
        return null // expired / tampered token
    }
}

// Protects admin pages
const checkuserauth = async (req, res, next) => {
    const admin = req.admin !== undefined ? req.admin : await loadAdmin(req)
    if (!admin) {
        res.clearCookie('token')
        req.flash('error', 'UnAuthorized user, Please Login')
        return res.redirect('/')
    }
    req.admin = admin
    req.data1 = admin
    res.locals.admin = admin
    next()
}

// Makes the admin available to every view (header name/email) without forcing a login
checkuserauth.attachAdmin = async (req, res, next) => {
    req.admin = await loadAdmin(req)
    res.locals.admin = req.admin
    next()
}

checkuserauth.JWT_SECRET = JWT_SECRET

module.exports = checkuserauth
