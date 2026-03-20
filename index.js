const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");
const ChannelID = require("./ChannelID");
require("dotenv").config();
const cron = require("node-cron");
const path = require("path");
const axios = require("axios");
const moment = require("moment-timezone");
const { error } = require("console");
const assets = require("./PathAssets");
const fs = require("fs");

const client = new Client({
  disableMentions: "everyone",
  restTimeOffset: 0,
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
  ],
});

// Variables to store used video
let usedFastingVideos = [];
let usedImsakVideos = [];
let usedLebaranVideos = [];
let lastResetDate = null;

// Add error logging function
function logError(error, context) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${context}: ${error.message}\n${error.stack}\n\n`;
  const logPath = path.join(__dirname, "errorLog.txt");

  try {
    fs.appendFileSync(logPath, logEntry);
  } catch (logError) {
    console.error("Failed to write to error log:", logError);
  }
}

client.login(process.env.TOKEN);

client.on("warn", (info) => console.log(info));
client.on("error", console.error);
client.on("ready", () => {
  const channel = client.channels.cache.get(ChannelID.TestChannelID);
  console.log(`${client.user.username} ready!`);
  channel.send("Toa Mesjid Online 🔈🔉🔊");
});

// Add this function before the messageCreate event
async function fetchImsakiyah(provinsi, kabkota) {
  try {
    const response = await axios.post("https://equran.id/api/v2/imsakiyah", {
      provinsi,
      kabkota,
    });
    return response.data;
  } catch (error) {
    logError(error, `fetchImsakiyah - ${kabkota}`);
    console.error(`Error fetching imsakiyah for ${kabkota}:`, error);
    return null;
  }
}

function getCurrentDate() {
  return new Date().getDate();
}

function extractImsakiyahData(apiResponse, currentRamadanDay) {
  if (!apiResponse || !apiResponse.data) return null;

  const { kabkota, imsakiyah } = apiResponse.data;
  const todaySchedule = imsakiyah.find(
    (schedule) => schedule.tanggal === currentRamadanDay
  );

  if (!todaySchedule) return null;

  return {
    kabkota,
    tanggal: todaySchedule.tanggal,
    imsak: todaySchedule.imsak,
    subuh: todaySchedule.subuh,
    maghrib: todaySchedule.maghrib,
  };
}
function getCurrentRamadanDay() {
  // Ramadan 2025 starts on February 19, 2026 (1st day of Ramadan)
  // ? You set manually the start date of Ramadan here, since it changes every year, and we need it to calculate the current day of Ramadan
  // ? It's differenciate between NU or Muhamadiyah, so decide which one you want to use, or you can update it every year when Ramadan starts
  const ramadanStartDate = moment.tz("2026-02-19", "Asia/Jakarta");
  const today = moment.tz("Asia/Jakarta");

  // Calculate days since Ramadan started
  const daysDifference = today.diff(ramadanStartDate, "days");

  // Ramadan day is 1-based, so add 1
  const ramadanDay = daysDifference + 1;

  // Ensure it's within valid Ramadan range (1-30)
  if (ramadanDay < 1) {
    console.log(`Not in Ramadan period. Calculated day: ${ramadanDay}`);
    return null;
  }
  if (ramadanDay > 30) {
    return false;
  }

  return ramadanDay;
}

async function initializeImsakiyahData() {
  const currentRamadanDay = getCurrentRamadanDay();
  // If not in Ramadan period, return empty data
  if (currentRamadanDay === null) {
    console.log("Not currently in Ramadan period");
    return {};
  }
  if (currentRamadanDay === false) {
    console.log("Lebaran Coy");
    return { isLebaran: true };
  }

  const locations = [
    {
      name: "majalengka",
      provinsi: "Jawa Barat",
      kabkota: "Kab. Majalengka",
    },
    { name: "jogja", provinsi: "D.I. Yogyakarta", kabkota: "Kota Yogyakarta" },
    {
      name: "samarinda",
      provinsi: "Kalimantan Timur",
      kabkota: "Kota Samarinda",
    },
    { name: "jakarta", provinsi: "DKI Jakarta", kabkota: "Kota Jakarta" },
    { name: "tangerang", provinsi: "Banten", kabkota: "Kab. Tangerang" },
  ];

  const imsakiyahData = {};

  for (const location of locations) {
    const apiResponse = await fetchImsakiyah(
      location.provinsi,
      location.kabkota
    );
    const extractedData = extractImsakiyahData(apiResponse, currentRamadanDay);
    imsakiyahData[
      `imsakiyah${
        location.name.charAt(0).toUpperCase() + location.name.slice(1)
      }Now`
    ] = extractedData;
  }

  return imsakiyahData;
}

function calculateCountdownToMaghrib(maghribTime) {
  // Use moment for Jakarta timezone
  const now = moment.tz("Asia/Jakarta");
  const [hours, minutes] = maghribTime.split(":").map(Number);

  // Create maghrib time for today
  const maghribDateTime = now.clone().set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });

  const diffMinutes = maghribDateTime.diff(now, "minutes");

  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `sabar bos ${hours} jam ${remainingMinutes} menit lagi buka (Jakarta WIB)`;
    } else {
      return `sabar bos ${hours} jam lagi buka (Jakarta WIB)`;
    }
  } else {
    return `sabar bos ${diffMinutes} menit lagi buka (Jakarta WIB)`;
  }
}

function isLunchTime() {
  const now = moment.tz("Asia/Jakarta");
  const currentHour = now.hour();

  // Check if current time is between 12 PM (12:00) and 1 PM (13:00)
  return currentHour >= 12 && currentHour < 13;
}

function formatMaghribTimes(imsakiyahData) {
  const maghribTimes = [
    `Puasa hari ke : ${imsakiyahData.imsakiyahJakartaNow?.tanggal || "N/A"}`,
    `Majalengka : ${
      imsakiyahData.imsakiyahMajalengkaNow?.maghrib || "N/A"
    } WIB`,
    `Jogja : ${imsakiyahData.imsakiyahJogjaNow?.maghrib || "N/A"} WIB`,
    `Samarinda : ${imsakiyahData.imsakiyahSamarindaNow?.maghrib || "N/A"} WITA`,
    `Jakarta : ${imsakiyahData.imsakiyahJakartaNow?.maghrib || "N/A"} WIB`,
    `Tangerang : ${imsakiyahData.imsakiyahTangerangNow?.maghrib || "N/A"} WIB`,
  ].join("\n");

  return maghribTimes;
}

function formatImsakTimes(imsakiyahData) {
  const imsakTimes = [
    `Puasa hari ke : ${imsakiyahData.imsakiyahJakartaNow?.tanggal || "N/A"}`,
    `Majalengka : ${imsakiyahData.imsakiyahMajalengkaNow?.imsak || "N/A"} WIB`,
    `Jogja : ${imsakiyahData.imsakiyahJogjaNow?.imsak || "N/A"} WIB`,
    `Samarinda : ${imsakiyahData.imsakiyahSamarindaNow?.imsak || "N/A"} WITA`,
    `Jakarta : ${imsakiyahData.imsakiyahJakartaNow?.imsak || "N/A"} WIB`,
    `Tangerang : ${imsakiyahData.imsakiyahTangerangNow?.imsak || "N/A"} WIB`,
  ].join("\n");

  return imsakTimes;
}

function calculateCountdownToImsak(imsakTime) {
  // Use moment for Jakarta timezone
  const now = moment.tz("Asia/Jakarta");
  const [hours, minutes] = imsakTime.split(":").map(Number);

  // Create imsak time
  let imsakDateTime = now.clone().set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });

  // If imsak time has already passed today, it means tomorrow's imsak
  if (imsakDateTime.isBefore(now) || imsakDateTime.isSame(now)) {
    imsakDateTime.add(1, "day");
  }

  const diffMinutes = imsakDateTime.diff(now, "minutes");

  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `ya makan anjir, masih ${hours} jam ${remainingMinutes} menit sebelom imsak (WIB)`;
    } else {
      return `ya makan anjir, masih ${hours} jam sebelom imsak (WIB)`;
    }
  } else {
    return `ya makan anjir, masih ${diffMinutes} menit sebelom imsak (WIB)`;
  }
}

function isWithinFastingHours(imsakiyahData) {
  const currentTime = moment.tz("Asia/Jakarta");

  // Get any available Maghrib time
  const maghribTime =
    imsakiyahData.imsakiyahJakartaNow?.maghrib ||
    imsakiyahData.imsakiyahMajalengkaNow?.maghrib ||
    imsakiyahData.imsakiyahJogjaNow?.maghrib ||
    imsakiyahData.imsakiyahSamarindaNow?.maghrib ||
    imsakiyahData.imsakiyahTangerangNow?.maghrib;

  if (!maghribTime) return false;

  const maghrib = moment.tz(maghribTime, "HH:mm", "Asia/Jakarta");
  const imsak = moment.tz("05:00", "HH:mm", "Asia/Jakarta");

  return currentTime.isBetween(imsak, maghrib);
}

function isWithinSahurHours(imsakiyahData) {
  const currentTime = moment.tz("Asia/Jakarta");

  // Get any available Maghrib time for sahur start
  const maghribTime =
    imsakiyahData.imsakiyahJakartaNow?.maghrib ||
    imsakiyahData.imsakiyahMajalengkaNow?.maghrib ||
    imsakiyahData.imsakiyahJogjaNow?.maghrib ||
    imsakiyahData.imsakiyahSamarindaNow?.maghrib ||
    imsakiyahData.imsakiyahTangerangNow?.maghrib;

  // Get any available Imsak time for tomorrow
  const imsakTime =
    imsakiyahData.imsakiyahJakartaNow?.imsak ||
    imsakiyahData.imsakiyahMajalengkaNow?.imsak ||
    imsakiyahData.imsakiyahJogjaNow?.imsak ||
    imsakiyahData.imsakiyahSamarindaNow?.imsak ||
    imsakiyahData.imsakiyahTangerangNow?.imsak;

  if (!maghribTime || !imsakTime) return false;

  const maghrib = moment.tz(maghribTime, "HH:mm", "Asia/Jakarta");
  const imsak = moment.tz(imsakTime, "HH:mm", "Asia/Jakarta");

  return currentTime.isAfter(maghrib) || currentTime.isBefore(imsak);
}

function resetDailyVideosIfNeeded() {
  const today = moment.tz("Asia/Jakarta").format("YYYY-MM-DD");

  if (lastResetDate !== today) {
    usedFastingVideos = [];
    usedImsakVideos = [];
    lastResetDate = today;
    console.log(`Daily videos reset for ${today}`);
  }
}

// Function to get a random unused video based on fasting or imsak category
function getRandomUnusedVideo(options = { type: "normal" }) {
  resetDailyVideosIfNeeded();

  const fastingVideos = [
    assets.images.lapar,
    assets.images.puasaGaSih,
    assets.videos.bukaJamBerapa,
    assets.videos.esBuah,
    assets.videos.esTeh,
    assets.videos.bahlil,
    assets.videos.ashadu,
    assets.videos.sederhana,
    assets.videos.ayam,
    assets.videos.mancing1,
    assets.videos.mancing2,
    assets.videos.mancing3,
    assets.videos.maju,
    assets.videos.cobaDulu,
    assets.videos.ojok,
  ];

  const imsakVideos = [
    assets.images.kerupuk,
    assets.gifs.oguriMakan,
    assets.images.himariMokel,
    assets.videos.bukaGes,
    assets.videos.waktunyaBuka,
    assets.videos.wahyuDibadog,
    assets.videos.kueNiga,
    assets.videos.bis,
    assets.videos.petasan,
    assets.videos.ayam,
    assets.videos.mancing1,
    assets.videos.mancing2,
    assets.videos.mancing3,
    assets.videos.cobaDulu,
    assets.videos.ojok,
  ];

  const lebaranVideos = [
    assets.videos.lebaran1,
    assets.videos.lebaran2,
    assets.videos.lebaran3,
    assets.images.lebaran,
  ];

  // Select appropriate arrays based on type
  let videoPaths, usedVideosArray, categoryName;

  switch (options.type) {
    case "fasting":
      videoPaths = fastingVideos;
      usedVideosArray = usedFastingVideos;
      categoryName = "fasting";
      break;
    case "imsak":
      videoPaths = imsakVideos;
      usedVideosArray = usedImsakVideos;
      categoryName = "imsak";
      break;
    case "lebaran":
      videoPaths = lebaranVideos;
      usedVideosArray = usedLebaranVideos;
      categoryName = "lebaran";
      break;
    default:
      videoPaths = imsakVideos;
      usedVideosArray = usedImsakVideos;
      categoryName = "normal";
  }

  // Get available videos (not used today in this category)
  const availableVideos = videoPaths.filter(
    (video) => !usedVideosArray.includes(video)
  );

  // If all videos are used, reset and use all videos again
  if (availableVideos.length === 0) {
    switch (options.type) {
      case "fasting":
        usedFastingVideos = [];
        break;
      case "imsak":
        usedImsakVideos = [];
        break;
      case "lebaran":
        usedLebaranVideos = [];
        break;
    }
    availableVideos.push(...videoPaths);
    console.log(`All ${categoryName} videos used today, resetting...`);
  }

  // Randomly select from available videos
  const randomIndex = Math.floor(Math.random() * availableVideos.length);
  const selectedVideo = availableVideos[randomIndex];

  // Mark this video as used in the appropriate category
  switch (options.type) {
    case "fasting":
      usedFastingVideos.push(selectedVideo);
      break;
    case "imsak":
      usedImsakVideos.push(selectedVideo);
      break;
    case "lebaran":
      usedLebaranVideos.push(selectedVideo);
      break;
  }

  console.log(`Selected ${categoryName} video: ${selectedVideo}`);
  console.log(
    `Used ${categoryName} videos today: ${usedVideosArray.length + 1}/${
      videoPaths.length
    }`
  );

  return selectedVideo;
}

async function handleLaparMessage(message) {
  try {
    const imsakiyahData = await initializeImsakiyahData();

    const itsLebaran = imsakiyahData.isLebaran;

    if (itsLebaran) {
      const randomizeMeme = getRandomUnusedVideo({ type: "lebaran" });
      await message.reply({
        content:
          "Udah lebaran coy, ga usah like people difficult, makan opor aja\nMinal Aidzin Wal Faidzin, mohon maaf lahir dan batin\nSelamat Hari Raya Idul Fitri 1447 H",
        files: [randomizeMeme],
      });
      return;
    }

    // Check if all API calls failed
    const allDataFailed =
      !imsakiyahData.imsakiyahMajalengkaNow &&
      !imsakiyahData.imsakiyahJogjaNow &&
      !imsakiyahData.imsakiyahSamarindaNow &&
      !imsakiyahData.imsakiyahJakartaNow &&
      !imsakiyahData.imsakiyahTangerangNow;

    if (allDataFailed) {
      await message.reply({
        content: "Marbot mesjid kabur, printer rusak",
      });
      return;
    }

    if (isWithinFastingHours(imsakiyahData)) {
      // Randomly select one video
      const randomizeMeme = getRandomUnusedVideo({ type: "fasting" });

      // Existing maghrib countdown logic
      const jakartaMaghrib = imsakiyahData.imsakiyahJakartaNow?.maghrib;
      const majalengkaMaghrib = imsakiyahData.imsakiyahMajalengkaNow?.maghrib;
      const jogjaMaghrib = imsakiyahData.imsakiyahJogjaNow?.maghrib;
      const samarindaMaghrib = imsakiyahData.imsakiyahSamarindaNow?.maghrib;
      const tangerangMaghrib = imsakiyahData.imsakiyahTangerangNow?.maghrib;

      if (
        jakartaMaghrib ||
        majalengkaMaghrib ||
        jogjaMaghrib ||
        samarindaMaghrib ||
        tangerangMaghrib
      ) {
        const referenceMaghrib =
          jakartaMaghrib ||
          majalengkaMaghrib ||
          jogjaMaghrib ||
          samarindaMaghrib ||
          tangerangMaghrib;

        const countdownText = calculateCountdownToMaghrib(referenceMaghrib);
        const maghribTimes = formatMaghribTimes(imsakiyahData);
        const messageContent = `${countdownText}\n\n${maghribTimes}`;

        // Check if its lunch time
        if (isLunchTime()) {
          const videoPaths = [
            assets.videos.cokA,
            assets.videos.hariIniAkuMokel,
          ];
          const randomizeMeme =
            videoPaths[Math.floor(Math.random() * videoPaths.length)];
          await message.reply({
            content: messageContent,
            files: [randomizeMeme],
          });
          return;
        }
        await message.reply({
          content: messageContent,
          files: [randomizeMeme],
        });
      } else {
        await message.reply({
          content: "Data maghrib tidak tersedia",
        });
      }
    } else if (isWithinSahurHours(imsakiyahData)) {
      // Randomly select one video
      const randomizeMeme = getRandomUnusedVideo({ type: "imsak" });
      // New imsak countdown logic
      const jakartaImsak = imsakiyahData.imsakiyahJakartaNow?.imsak;
      const majalengkaImsak = imsakiyahData.imsakiyahMajalengkaNow?.imsak;
      const jogjaImsak = imsakiyahData.imsakiyahJogjaNow?.imsak;
      const samarindaImsak = imsakiyahData.imsakiyahSamarindaNow?.imsak;
      const tangerangImsak = imsakiyahData.imsakiyahTangerangNow?.imsak;

      if (
        jakartaImsak ||
        majalengkaImsak ||
        jogjaImsak ||
        samarindaImsak ||
        tangerangImsak
      ) {
        const referenceImsak =
          jakartaImsak ||
          majalengkaImsak ||
          jogjaImsak ||
          samarindaImsak ||
          tangerangImsak;

        const countdownText = calculateCountdownToImsak(referenceImsak);
        const imsakTimes = formatImsakTimes(imsakiyahData);
        const messageContent = `${countdownText}\n\n${imsakTimes}`;

        await message.reply({
          content: messageContent,
          files: [randomizeMeme],
        });
      } else {
        await message.reply({
          content: "Data imsak tidak tersedia",
        });
      }
    } else {
      await message.reply({
        content: "Mesjid sepi",
      });
    }
  } catch (error) {
    logError(error, "handleLaparMessage");
    console.error("Error in handleLaparMessage:", error);

    // Determine error type and create user-friendly message
    let errorMessage = "Terjadi error, coba lagi nanti";

    if (error.code === "ENOENT") {
      // File not found error
      const fileName = error.path
        ? error.path.split("/").pop()
        : "unknown file";
      errorMessage = `Error: Takjil hilang - ${fileName}`;
    } else if (
      error.message &&
      error.message.includes("Cannot read properties")
    ) {
      // Discord.js attachment error
      errorMessage = "Error: Discord ngerusak Takjil";
    } else if (error.message && error.message.includes("Missing Permissions")) {
      // Permission error
      errorMessage = "Error: Marbot ga dibolehin";
    } else if (error.message && error.message.includes("timeout")) {
      // API timeout
      errorMessage = "Error: Marbot cari takjil ga balik-balik (Timeout)";
    } else if (error.name === "AxiosError") {
      // API request error
      errorMessage = `Error: Marbot bawa kabur takjil (API Failure) (${
        error.response?.status || "unknown"
      })`;
    } else {
      // Generic error with partial message
      const shortError = error.message
        ? error.message.substring(0, 50)
        : error.toString().substring(0, 50);
      errorMessage = `Error: ${shortError}...`;
    }

    try {
      await message.reply({
        content: errorMessage,
      });
    } catch (replyError) {
      logError(replyError, "handleLaparMessage - reply error");

      // Try to send to channel if reply fails
      try {
        const channel = client.channels.cache.get(ChannelID.TestChannelID);
        await channel.send({
          content: `${errorMessage} (reply gagal)`,
        });
      } catch (channelError) {
        logError(channelError, "handleLaparMessage - channel send error");
      }
    }
  }
}

client.on("messageCreate", async (message) => {
  // const channel = client.channels.cache.get(ChannelID.TestChannelID);
  if (message.author.bot) return;
  const content = message.content;

  const lapar = /(^| |\"|\')lapar nich( |$|\.|\,|!|\?|\:|\;|\"|\')/i;
  if (lapar.test(content) || content.includes("796773828059201616")) {
    await handleLaparMessage(message);
    // return;
  }
});
client.on("messageCreate", async (message) => {
  // const channel = client.channels.cache.get(ChannelID.TestChannelID);
  if (message.author.bot) return;
  const content = message.content;

  const lapar = /(^| |\"|\')lebaran nich( |$|\.|\,|!|\?|\:|\;|\"|\')/i;
  if (lapar.test(content) || content.includes("796773828059201616")) {
    const randomizeMeme = getRandomUnusedVideo({ type: "lebaran" });
    await message.reply({
      content: "Habede Lebaran 1447 H semoga mohon maaf lahir batin",
      files: [randomizeMeme],
    });
    // return;
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const content = message.content;
  const checkAssets =
    /(^| |\"|\')ingfo stok takjil( |$|\.|\,|!|\?|\:|\;|\"|\')/i;
  if (checkAssets.test(content) || content.includes("796773828059201616")) {
    await message.reply({
      content: `Ingfo meme mesjid :\nTotal gambar : ${
        assets.getAssetCounts().imagesCount
      } ekor\nTotal video : ${
        assets.getAssetCounts().videosCount
      } ekor\nTotal gif : ${assets.getAssetCounts().gifsCount} ekor`,
    });
  }
});

function sahurAlert() {
  // Schedule for 3:00 AM Jakarta time (UTC+7) every day
  cron.schedule(
    "0 3 * * *",
    async () => {
      try {
        // const channel = client.channels.cache.get(ChannelID.BotChannelID);
        const channel = client.channels.cache.get(ChannelID.TestChannelID);

        if (!channel) {
          console.error("Channel not found");
          return;
        }

        // Array of video paths
        const videoPaths = [assets.videos.sahur1, assets.videos.sahur2];

        // Randomly select one video
        const selectedVideoPath =
          videoPaths[Math.floor(Math.random() * videoPaths.length)];

        const attachment = new AttachmentBuilder(selectedVideoPath, {
          name: path.basename(selectedVideoPath),
        });

        await channel.send({
          content: "Sahur",
          files: [attachment],
        });

        console.log(
          `Sahur alert sent successfully with ${path.basename(
            selectedVideoPath
          )}`
        );
      } catch (error) {
        console.error("Error sending sahur alert:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Jakarta",
    }
  );
}
function eidAlert() {
  // Schedule for 6:00 AM Jakarta time (UTC+7) every day
  cron.schedule(
    "0 6 * * *",
    async () => {
      try {
        // const channel = client.channels.cache.get(ChannelID.BotChannelID);
        const channel = client.channels.cache.get(ChannelID.TestChannelID);

        if (!channel) {
          console.error("Channel not found");
          return;
        }

        const attachment = new AttachmentBuilder(assets.videos.lebaran3, {
          name: path.basename(assets.videos.lebaran3),
        });

        await channel.send({
          content:
            "Selamat Pagiii, Selamat Hari Raya Idul Fitri 1447 H ヾ(≧▽≦*)o\n\nMinal Aidzin Wal Faidzin, mohon maaf lahir dan batin 🙏🙏\n\nJangan lupa sholat i'dul fitri berjamaah di mesjid coy\nbuat yang NU NU ajah\nyang Muhamadiyah kan dah kemaren\n\nJangan lupa mukbang kue kering nya sampe wareg🫃🫃",
          files: [attachment],
        });

        console.log(`Sahur alert sent successfully with ${attachment}`);
      } catch (error) {
        console.error("Error sending sahur alert:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Jakarta",
    }
  );
}

// ? /////////////////////////////////////////////////////////
// ? Function for checking wether now is ramadhan or not,
// ? uncomment if you want to use this, it will do cron schedule at 00:00 every day to check if its ramadhan or lebaran, and send alert accordingly
// cron.schedule(
//   "0 0 * * *",
//   async () => {
//     console.log("Checking Ramadan status...");
//     await cronChecker();
//   },
//   {
//     scheduled: true,
//     timezone: "Asia/Jakarta",
//   }
// );
// async function cronChecker() {
//   const checkRamadhan = await initializeImsakiyahData();
//   const itsLebaran = checkRamadhan.isLebaran;
//   if (itsLebaran) {
//     eidAlert();
//   } else {
//     sahurAlert();
//   }
// }
// cronChecker();
// ? //////////////////////////////////////////////////////////
// ? Or manually call the function to check if its ramadhan or lebaran and send alert accordingly,
// ? you can comment out one of them if you only want to use one of the alert
// v Turned off sahur alert for now, since its not Ramadan yet,
// sahurAlert();
eidAlert();

process.stdin.resume();
//Close Message When the bot is turned off or killed the process
//Delay close for 3 seconds function
const timeoutclose = setTimeout(function () {
  console.log("3 seconds delay when closed");
}, 3000);
//Sleep for ctrl+C
// function sleep(time) {
//   return new Promise((resolve) => setTimeout(resolve, time));
// }
// process.on("SIGHUP", function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGINT", function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
//   sleep(3000).then(() => {
//     process.exit(0);
//   });
// });
// process.on("SIGTERM", function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGKILL", function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGUSR1", async function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGUSR2", async function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("exit", function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("uncaughtException", async function () {
//   const channel = client.channels.cache.get(ChannelID.TestChannelID);
//   message.reply("Pengharum Ruangan Offline");
// });
