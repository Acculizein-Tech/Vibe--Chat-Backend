import Priceplan from "../models/Priceplan.js";

//create price plan

// export const createPricePlan = async (req, res) => {
//   try {
//     const { priceName, price, duration, features } = req.body;

//     const newPricePlan = new Priceplan({
//       priceName,
//       price,
//       duration,
//       features
//     });

//     const savedPricePlan = await newPricePlan.save();

//     res.status(201).json({
//       message: "Price plan created successfully",
//       pricePlan: savedPricePlan
//     });
//   } catch (error) {
//     console.error("Error creating price plan:", error);
//     res.status(500).json({ message: "Server Error", error: error.message });
//   }
// };
export const createPricePlan = async (req, res) => {
  try {
    let { priceName, price, duration, isService, features, discount } = req.body;

    // Convert features array of strings to array of objects if needed
    if (Array.isArray(features) && typeof features[0] === "string") {
      features = features.map(f => ({ label: f }));
    }

    const newPricePlan = new Priceplan({
      priceName,
      price,
      discount,
      duration,
      isService,
      features
    });

    const savedPricePlan = await newPricePlan.save();

    res.status(201).json({
      message: "Price plan created successfully",
      pricePlan: savedPricePlan
    });
  } catch (error) {
    console.error("Error creating price plan:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



//get all price plans
export const getAllPlans = async (req, res) => {
  try {
    const plans = await Priceplan.find().sort({ createdAt: -1 });

    if (!plans || plans.length === 0) {
      return res.status(404).json({
        message: "No price plans found"
      });
    }

    res.status(200).json({
      message: "Price plans retrieved successfully",
      plans
    });
  } catch (error) {
    console.error("Error fetching price plans:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

//update price plan by id
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedPlan = await Priceplan.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedPlan) {
      return res.status(404).json({ message: "Price plan not found" });
    }
    res.status(200).json({
      message: "Price plan updated successfully",
      plan: updatedPlan
    }); 
    } catch (error) {
    console.error("Error updating price plan:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

//Delete price plan by id
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPlan = await Priceplan.findByIdAndDelete(id);
    if (!deletedPlan) {
      return res.status(404).json({ message: "Price plan not found" });
    }   
    res.status(200).json({
      message: "Price plan deleted successfully",
      plan: deletedPlan
    });
  } catch (error) {
    console.error("Error deleting price plan:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
    }
}