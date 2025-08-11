import mongoose from 'mongoose';

const SelfSchema = new mongoose.Schema({
  speciality: {   
    type: String,
    
  },
  registerNumber: {
    type: String,
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
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    // ✅ Newly added travel-related facilities
   partTime: { type: Boolean, default: false },
  fullTime: { type: Boolean, default: false },
  freelance: { type: Boolean, default: false },
  },

 // ✅ Separate model form fields
  height: { type: String, default: '' }, // e.g., "5'8\""
  weight: { type: String, default: '' }, // in kg or lbs
  bust: { type: String, default: '' }, // fullest part of chest
  skinTone: { type: String, default: '' }, // below chest
  eyeColour: { type: String, default: '' }, // just below bust
  hairColour: { type: String, default: '' }, // just below bust
  nationality: { type: String, default: '' }, // above hips
  religion: { type: String, default: '' }, // widest part of hips
  caste: { type: String, default: '' }, // upper thigh
  maritalStatus: { type: String, default: '' }, // calf
  presentProfession: { type: String, default: '' }, // shoulders
  education: { type: String, default: '' },
  hobbies: { type: String, default: '' }, // bicep
  language: { type: String, default: '' }, // language skills
  awards: { type: String, default: '' }, // awards and recognitions


 // ✅ Organized Hobby Categories
  hobbies: {
    creativeArtistic: {
      drawingSketching: { type: Boolean, default: false },
      painting: { type: Boolean, default: false },
      calligraphy: { type: Boolean, default: false },
      doodlingMandala: { type: Boolean, default: false },
      origamiPaperCraft: { type: Boolean, default: false },
      diyProjects: { type: Boolean, default: false },
      potteryClayArt: { type: Boolean, default: false },
      mehndiHennaDesign: { type: Boolean, default: false },
      fashionDesigning: { type: Boolean, default: false },
      makeupBeautyArtistry: { type: Boolean, default: false },
      interiorDesigning: { type: Boolean, default: false },
    },
    performingArts: {
      singing: { type: Boolean, default: false },
      dancing: { type: Boolean, default: false },
      actingTheatre: { type: Boolean, default: false },
      musicalInstruments: { type: Boolean, default: false },
      standupComedy: { type: Boolean, default: false },
      mimicryVoiceover: { type: Boolean, default: false },
      beatboxing: { type: Boolean, default: false },
      rapping: { type: Boolean, default: false },
    },
    writingReading: {
      readingBooks: { type: Boolean, default: false },
      writingPoems: { type: Boolean, default: false },
      blogging: { type: Boolean, default: false },
      journaling: { type: Boolean, default: false },
      storyWriting: { type: Boolean, default: false },
      scriptWriting: { type: Boolean, default: false },
      contentWriting: { type: Boolean, default: false },
      editingProofreading: { type: Boolean, default: false },
    },
       digitalContentCreation: {
      photography: { type: Boolean, default: false },
      videography: { type: Boolean, default: false },
      graphicDesigning: { type: Boolean, default: false },
      videoEditing: { type: Boolean, default: false },
      contentCreation: { type: Boolean, default: false },
      socialMediaInfluencing: { type: Boolean, default: false },
      animationIllustration: { type: Boolean, default: false },
      podcasting: { type: Boolean, default: false },
      memeCreation: { type: Boolean, default: false }
    },
    travelExploration: {
      travelingExploring: { type: Boolean, default: false },
      trekkingHiking: { type: Boolean, default: false },
      backpacking: { type: Boolean, default: false },
      camping: { type: Boolean, default: false },
      roadTrips: { type: Boolean, default: false },
      culturalTourism: { type: Boolean, default: false }
    },
    healthLifestyle: {
      gymmingBodybuilding: { type: Boolean, default: false },
      yogaMeditation: { type: Boolean, default: false },
      aerobicsZumba: { type: Boolean, default: false },
      dietPlanning: { type: Boolean, default: false },
      mentalWellness: { type: Boolean, default: false }
    },
    cookingFood: {
      cooking: { type: Boolean, default: false },
      baking: { type: Boolean, default: false },
      foodBlogging: { type: Boolean, default: false },
      tryingNewRecipes: { type: Boolean, default: false },
      streetFoodExploring: { type: Boolean, default: false }
    },
    intellectualLearning: {
      solvingPuzzles: { type: Boolean, default: false },
      readingNonFiction: { type: Boolean, default: false },
      learningLanguages: { type: Boolean, default: false },
      researchCaseStudies: { type: Boolean, default: false },
      studyingHistoryMythology: { type: Boolean, default: false },
      watchingDocumentaries: { type: Boolean, default: false },
      publicSpeakingDebating: { type: Boolean, default: false },
      investingFinance: { type: Boolean, default: false },
      writingQuotesMotivation: { type: Boolean, default: false }
    },
    educationTech: {
      codingProgramming: { type: Boolean, default: false },
      webAppDesigning: { type: Boolean, default: false },
      robotics: { type: Boolean, default: false },
      onlineCourseLearning: { type: Boolean, default: false },
      scienceExperiments: { type: Boolean, default: false },
      diyElectronics: { type: Boolean, default: false }
    },
    sportsGames: {
      cricket: { type: Boolean, default: false },
      football: { type: Boolean, default: false },
      basketball: { type: Boolean, default: false },
      badminton: { type: Boolean, default: false },
      tableTennis: { type: Boolean, default: false },
      chess: { type: Boolean, default: false },
      skating: { type: Boolean, default: false },
      martialArts: { type: Boolean, default: false },
      athletics: { type: Boolean, default: false },
      yogaCompetitions: { type: Boolean, default: false }
    },
    indoorEntertainment: {
      videoGames: { type: Boolean, default: false },
      watchingMoviesSeries: { type: Boolean, default: false },
      listeningMusicPodcasts: { type: Boolean, default: false },
      bingeWatching: { type: Boolean, default: false },
      onlineQuizzesTrivia: { type: Boolean, default: false },
      virtualSimulations: { type: Boolean, default: false }
    },
    natureAnimals: {
      gardeningUrbanFarming: { type: Boolean, default: false },
      birdWatching: { type: Boolean, default: false },
      natureWalks: { type: Boolean, default: false },
      petCareAnimalRescue: { type: Boolean, default: false },
      aquariumFishCare: { type: Boolean, default: false }
    },
    communitySocial: {
      volunteeringSocialWork: { type: Boolean, default: false },
      helpingNGOs: { type: Boolean, default: false },
      bloodDonationCampaigns: { type: Boolean, default: false },
      publicMotivationLifeCoaching: { type: Boolean, default: false },
      eventHostingAnchoring: { type: Boolean, default: false }
    },
    offbeatSpiritual: {
      astrologyNumerology: { type: Boolean, default: false },
      tarotReading: { type: Boolean, default: false },
      crystalHealing: { type: Boolean, default: false },
      reiki: { type: Boolean, default: false },
      energyWork: { type: Boolean, default: false },
      palmistry: { type: Boolean, default: false },
      dreamInterpretation: { type: Boolean, default: false }
    },
    collectingOther: {
      collectingCoins: { type: Boolean, default: false },
      collectingStamps: { type: Boolean, default: false },
      collectingArtifacts: { type: Boolean, default: false },
      collectingAntiques: { type: Boolean, default: false },
      watchingReviewingTech: { type: Boolean, default: false },
      organizingEvents: { type: Boolean, default: false }
    },
    others: { type: String, default: '' }
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

const Self = mongoose.model('Self', SelfSchema);
export default Self;
