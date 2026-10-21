import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness between user pairs
friendshipSchema.index({ user1: 1, user2: 1 });

/**
 * Helper to check whether two users have an active friendship.
 */
friendshipSchema.statics.areFriends = async function (idA, idB) {
  if (!idA || !idB || idA.toString() === idB.toString()) {
    return false;
  }
  const friendship = await this.findOne({
    $or: [
      { user1: idA, user2: idB },
      { user1: idB, user2: idA },
    ],
  });
  return Boolean(friendship);
};

export const Friendship = mongoose.model('Friendship', friendshipSchema);
