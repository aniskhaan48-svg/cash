const prisma = require("../config/prisma");

const getSettings = async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          company_name_ar: "شركة تولان",
          company_name_en: "TOLAN CO",
          currency: "SAR",
        },
      });
    }

    return res.json({
      id: Number(settings.id),
      company_name_ar: settings.company_name_ar,
      company_name_en: settings.company_name_en,
      currency: settings.currency,
      logo_url: settings.logo_url,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const {
      company_name_ar,
      company_name_en,
      currency,
      logo_url,
    } = req.body;

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          company_name_ar,
          company_name_en,
          currency,
          logo_url,
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: {
          id: settings.id,
        },
        data: {
          company_name_ar,
          company_name_en,
          currency,
          logo_url,
        },
      });
    }

    return res.json({
      message: "Settings updated successfully",
      settings: {
        id: Number(settings.id),
        company_name_ar: settings.company_name_ar,
        company_name_en: settings.company_name_en,
        currency: settings.currency,
        logo_url: settings.logo_url,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};