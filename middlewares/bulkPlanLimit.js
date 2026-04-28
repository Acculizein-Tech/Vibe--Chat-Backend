export const PLAN_LIMITS = {
  free: 500,
  premium: 1000,
};

const getPlanKey = (user) => {
  const rawPlan = String(user?.subscriptionPlan || "").trim().toLowerCase();
  if (rawPlan === "premium") return "premium";
  return "free";
};

export const getUserPlanLimit = (user) => {
  const planKey = getPlanKey(user);
  return {
    plan: planKey,
    limit: PLAN_LIMITS[planKey],
  };
};

export const enforcePlanLimit = ({ user, contactsCount }) => {
  const { plan, limit } = getUserPlanLimit(user);
  const count = Number(contactsCount || 0);

  if (count <= limit) {
    return { allowed: true, plan, limit };
  }

  if (plan === "free") {
    return {
      allowed: false,
      plan,
      limit,
      message:
        "Limit exceeded. Free plan allows only 500 contacts. Upgrade to send more.",
    };
  }

  return {
    allowed: false,
    plan,
    limit,
    message: "Limit exceeded. Premium plan allows only 1000 contacts.",
  };
};

export const attachPlanLimit = (req, _res, next) => {
  const result = getUserPlanLimit(req.user);
  req.planLimit = result;
  next();
};
