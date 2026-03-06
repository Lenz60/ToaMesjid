const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");
const ChannelID = require("./ChannelID");
require("dotenv").config();
const cron = require("node-cron");
const path = require("path");
const axios = require("axios");
const moment = require("moment-timezone");
const { error } = require("console");
const assets = require("./PathAssets");

const client = new Client({
  disableMentions: "everyone",
  restTimeOffset: 0,
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
  ],
});

client.login(process.env.TOKEN);

client.on("warn", (info) => console.log(info));
client.on("error", console.error);
client.on("ready", () => {
  const channel = client.channels.cache.get(ChannelID.BotChannelID);
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
  const ramadanStartDate = moment.tz("2026-02-19", "Asia/Jakarta");
  const today = moment.tz("Asia/Jakarta");

  // Calculate days since Ramadan started
  const daysDifference = today.diff(ramadanStartDate, "days");

  // Ramadan day is 1-based, so add 1
  const ramadanDay = daysDifference + 1;

  // Ensure it's within valid Ramadan range (1-30)
  if (ramadanDay < 1 || ramadanDay > 30) {
    console.log(`Not in Ramadan period. Calculated day: ${ramadanDay}`);
    return null;
  }

  return ramadanDay;
}

async function initializeImsakiyahData() {
  const currentRamadanDay = getCurrentRamadanDay();

  // If not in Ramadan period, return empty data
  if (!currentRamadanDay) {
    console.log("Not currently in Ramadan period");
    return {};
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

async function handleLaparMessage(channel, message) {
  const imsakiyahData = await initializeImsakiyahData();

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

  // Add debugging
  // const fastingHours = isWithinFastingHours(imsakiyahData);
  // const sahurHours = isWithinSahurHours(imsakiyahData);
  // const currentTime = new Date().toLocaleString("id-ID", {
  //   timeZone: "Asia/Jakarta",
  // });

  // console.log(`Current time: ${currentTime}`);
  // console.log(`isWithinFastingHours: ${fastingHours}`);
  // console.log(`isWithinSahurHours: ${sahurHours}`);
  if (isWithinFastingHours(imsakiyahData)) {
    // Array of video paths
    const videoPaths = [
      assets.images.lapar,
      assets.images.puasaGaSih,
      assets.videos.bukaJamBerapa,
      assets.videos.esBuah,
      assets.videos.esTeh,
      assets.videos.bahlil,
      assets.videos.ashadu,
      assets.videos.sederhana,
      assets.videos.mancing1,
      assets.videos.mancing2,
      assets.videos.mancing3,
      assets.videos.maju,
      assets.videos.cobaDulu,
    ];

    // Randomly select one video
    const randomizeMeme =
      videoPaths[Math.floor(Math.random() * videoPaths.length)];

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
        const videoPaths = [assets.videos.cokA, assets.videos.hariIniAkuMokel];
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
    const videoPaths = [
      assets.images.kerupuk,
      assets.gifs.oguriMakan,
      assets.images.himariMokel,
      assets.videos.bukaGes,
      assets.videos.waktunyaBuka,
      assets.videos.wahyuDibadog,
      assets.videos.kueNiga,
      assets.videos.bis,
      assets.videos.petasan,
      assets.videos.mancing1,
      assets.videos.mancing2,
      assets.videos.mancing3,
      assets.videos.cobaDulu,
    ];

    // Randomly select one video
    const randomizeMeme =
      videoPaths[Math.floor(Math.random() * videoPaths.length)];
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
}

client.on("messageCreate", async (message) => {
  const channel = client.channels.cache.get(ChannelID.GeneralID);
  if (message.author.bot) return;
  const content = message.content;

  const lapar = /(^| |\"|\')lapar nich( |$|\.|\,|!|\?|\:|\;|\"|\')/i;
  if (lapar.test(content) || content.includes("796773828059201616")) {
    await handleLaparMessage(channel, message);
    return;
  }
});

function sahurAlert() {
  // Schedule for 3:00 AM Jakarta time (UTC+7) every day
  cron.schedule(
    "0 3 * * *",
    async () => {
      try {
        // const channel = client.channels.cache.get(ChannelID.BotChannelID);
        const channel = client.channels.cache.get(ChannelID.GeneralID);

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
sahurAlert();

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
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGINT", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
//   sleep(3000).then(() => {
//     process.exit(0);
//   });
// });
// process.on("SIGTERM", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGKILL", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGUSR1", async function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("SIGUSR2", async function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("exit", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
// process.on("uncaughtException", async function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   message.reply("Pengharum Ruangan Offline");
// });
