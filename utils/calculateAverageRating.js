// utils/calculateAverageRating.js
import Review from '../models/Review.js';
import Business from '../models/Business.js';

export const updateBusinessRating = async (businessId) => {
  const reviews = await Review.find({ business: businessId });

  const numberOfReviews = reviews.length;
  const averageRating = numberOfReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / numberOfReviews
    : 0;

  await Business.findByIdAndUpdate(businessId, {
    averageRating,
    numberOfReviews
  });
};

