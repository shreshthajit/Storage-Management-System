const mongoose = require("mongoose");

const verificationCodeSchema = new mongoose.Schema({
    code: String,
    email: String,
    is_active: Boolean,
}, {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
});

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);
module.exports = { VerificationCode };