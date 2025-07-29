import mongoose from 'mongoose';

const ModelsSchema = new mongoose.Schema({
  speciality: {
    type: String,
    required: true
  },
  registerNumber: {
    type: String,
    required: false,
    default: ''
  },
  YearOfEstablishment: {
    type: String,
    required: false,
    default: ''
  },
  appointmentLink: {
    type: String,
    default: ''
  },
  affiliation: {
    type: String,
    default: ''
  },
  GSTIN: {
    type: String,
    required: false,
    default: ''
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    // ✅ Newly added travel-related facilities
   sponsoredContentPosts: { type: Boolean, default: false },
    productEndorsements: { type: Boolean, default: false },
    unboxingVideos: { type: Boolean, default: false },
    tvCommercialAppearances: { type: Boolean, default: false },
    brandAmbassadorRoles: { type: Boolean, default: false },
    sponsoredSocialPosts: { type: Boolean, default: false },
    instagramReelsCollaborations: { type: Boolean, default: false },
    youtubeCollaborations: { type: Boolean, default: false },
    eventHostingAttendance: { type: Boolean, default: false },
    fashionShowAppearances: { type: Boolean, default: false },
    giveawaysContestHosting: { type: Boolean, default: false },
    swipeUpPromotionsStories: { type: Boolean, default: false },
    affiliateLinkPromotions: { type: Boolean, default: false },
    rampWalkRunwayModeling: { type: Boolean, default: false },
    magazineFeaturesEditorials: { type: Boolean, default: false },
    portfolioPhotoshootServices: { type: Boolean, default: false },
    voiceOverNarrationWork: { type: Boolean, default: false },
    fitnessInfluencerContent: { type: Boolean, default: false },
    musicVideoAppearances: { type: Boolean, default: false },
    regionalCampaignEngagements: { type: Boolean, default: false }
  },
  extraFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  }
});

const Models = mongoose.model('Models', ModelsSchema);
export default Models;
