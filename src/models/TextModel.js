const mongoose = require('mongoose');
const { Schema } = mongoose;

const contributionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    suggestion: { type: String, required: true },
  },
  { _id: true, timestamps: true }
);

const textSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userText: { type: String, required: true },

    correctedText: { type: String },
    correctedTextVi: { type: String },    
    correctedBy: { type: String },
    correctionDate: { type: Date },

    contributions: { type: [contributionSchema], default: [] },
  },
  { timestamps: true }
);

textSchema.index({ user: 1, createdAt: -1 });
textSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Text', textSchema);
